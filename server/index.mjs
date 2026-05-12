import cors from 'cors';
import express from 'express';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(serverDir, '../dist');
const envPath = path.resolve(serverDir, '../.env');

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}

const port = Number(process.env.PORT || 8787);
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: '256kb' }));

const districts = [
  '越秀区',
  '海珠区',
  '荔湾区',
  '天河区',
  '白云区',
  '黄埔区',
  '番禺区',
  '花都区',
  '南沙区',
  '从化区',
  '增城区',
];

const broadcastRarities = new Set(['legendary', 'epic', 'mutant', 'king']);

const isValidDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const normalizePlayerId = (value) => (typeof value === 'string' ? value.trim().slice(0, 32) : '');
const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

app.get('/api/health', async (_request, response) => {
  await pool.query('select 1');
  response.json({ ok: true, storage: 'postgresql' });
});

app.get('/api/players/:playerId/save', async (request, response) => {
  const playerId = normalizePlayerId(request.params.playerId);
  if (!playerId) {
    response.status(400).json({ error: 'invalid_player_id' });
    return;
  }

  const result = await pool.query(
    `
      select player_state, codex, updated_at
      from player_saves
      where player_id = $1
    `,
    [playerId],
  );

  const save = result.rows[0];
  response.json(save ? {
    player: save.player_state,
    codex: save.codex ?? {},
    updatedAt: save.updated_at,
  } : null);
});

app.put('/api/players/:playerId/save', async (request, response) => {
  const playerId = normalizePlayerId(request.params.playerId);
  const { player, codex } = request.body ?? {};

  if (
    !playerId ||
    !isObject(player) ||
    player.playerId !== playerId ||
    !isObject(codex)
  ) {
    response.status(400).json({ error: 'invalid_player_save_payload' });
    return;
  }

  await pool.query(
    `
      insert into player_saves (player_id, player_state, codex, updated_at)
      values ($1, $2::jsonb, $3::jsonb, now())
      on conflict (player_id)
      do update set
        player_state = excluded.player_state,
        codex = excluded.codex,
        updated_at = now()
    `,
    [playerId, JSON.stringify(player), JSON.stringify(codex)],
  );

  response.json({ ok: true });
});

app.get('/api/leaderboard/districts', async (request, response) => {
  const scoreDate = typeof request.query.date === 'string' && isValidDate(request.query.date)
    ? request.query.date
    : new Date().toISOString().slice(0, 10);

  const result = await pool.query(
    `
      select province, score
      from district_scores
      where score_date = $1
      order by score desc, province asc
    `,
    [scoreDate],
  );

  const scoreMap = new Map(result.rows.map((row) => [row.province, Number(row.score)]));
  response.json(
    districts
      .map((province) => ({ province, score: scoreMap.get(province) ?? 0 }))
      .sort((a, b) => b.score - a.score),
  );
});

app.get('/api/leaderboard/players', async (request, response) => {
  const scoreDate = typeof request.query.date === 'string' && isValidDate(request.query.date)
    ? request.query.date
    : new Date().toISOString().slice(0, 10);
  const requestedPlayerId = typeof request.query.playerId === 'string'
    ? request.query.playerId.slice(0, 32)
    : '';
  const requestedLimit = Number(request.query.limit);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(50, Math.max(1, Math.trunc(requestedLimit)))
    : 20;

  const result = await pool.query(
    `
      with player_totals as (
        select
          player_id,
          count(*) filter (where score_date = $1)::int as daily_catches,
          coalesce(sum(weight) filter (where score_date = $1), 0)::float as daily_weight,
          coalesce(sum(score) filter (where score_date = $1), 0)::int as daily_score,
          coalesce(sum(coins) filter (where score_date = $1), 0)::int as daily_coins,
          count(*)::int as total_catches,
          coalesce(sum(weight), 0)::float as total_weight,
          coalesce(sum(coins), 0)::int as total_coins
        from catch_events
        group by player_id
      ),
      candidates as (
        (select player_id from player_totals where daily_catches > 0 order by daily_weight desc, daily_score desc, daily_catches desc, player_id asc limit $2)
        union
        (select player_id from player_totals where daily_catches > 0 order by daily_coins desc, daily_score desc, daily_weight desc, player_id asc limit $2)
        union
        (select player_id from player_totals where total_catches > 0 order by total_catches desc, total_weight desc, player_id asc limit $2)
        union
        (select player_id from player_totals where total_coins > 0 order by total_coins desc, total_weight desc, player_id asc limit $2)
        union
        (select $3::text as player_id where $3 <> '')
      ),
      ranked as (
        select
          player_totals.*,
          row_number() over (
            order by daily_weight desc, daily_score desc, daily_catches desc, player_totals.player_id asc
          )::int as rank
        from player_totals
        inner join candidates on candidates.player_id = player_totals.player_id
      )
      select *
      from ranked
      order by rank asc
    `,
    [scoreDate, limit, requestedPlayerId],
  );

  response.json(result.rows.map((row) => ({
    id: row.player_id,
    rank: Number(row.rank),
    dailyCasts: Number(row.daily_catches),
    dailyWeight: Number(row.daily_weight),
    dailyScore: Number(row.daily_score),
    dailyCoins: Number(row.daily_coins),
    totalCasts: Number(row.total_catches),
    totalWeight: Number(row.total_weight),
    totalCoins: Number(row.total_coins),
  })));
});

app.get('/api/broadcasts', async (request, response) => {
  const requestedLimit = Number(request.query.limit);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(20, Math.max(1, Math.trunc(requestedLimit)))
    : 10;

  const result = await pool.query(
    `
      select player_id, province, fish_name, rarity, created_at
      from broadcast_events
      order by created_at desc, id desc
      limit $1
    `,
    [limit],
  );

  response.json(result.rows.map((row) => ({
    id: row.player_id,
    district: row.province,
    fish: row.fish_name,
    rarity: row.rarity,
    createdAt: row.created_at,
  })));
});

app.post('/api/catches', async (request, response) => {
  const {
    scoreDate,
    playerId,
    province,
    fishId,
    fishName,
    rarity,
    weight,
    score,
    coins,
  } = request.body ?? {};

  if (
    !isValidDate(scoreDate) ||
    typeof playerId !== 'string' ||
    !districts.includes(province) ||
    typeof fishId !== 'string' ||
    typeof fishName !== 'string' ||
     typeof rarity !== 'string' ||
     !Number.isFinite(Number(weight)) ||
     !Number.isFinite(Number(score)) ||
     (coins !== undefined && !Number.isFinite(Number(coins)))
  ) {
    response.status(400).json({ error: 'invalid_catch_payload' });
    return;
  }

  const normalizedPlayerId = playerId.slice(0, 32);
  const normalizedFishId = fishId.slice(0, 64);
  const normalizedFishName = fishName.slice(0, 64);
  const normalizedRarity = rarity.slice(0, 24);
  const normalizedWeight = Number(weight);
  const normalizedScore = Math.max(0, Math.round(Number(score)));
  const normalizedCoins = Math.max(0, Math.round(Number(coins ?? 0)));

  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(
      `
        insert into catch_events (
          score_date,
          player_id,
          province,
          fish_id,
          fish_name,
          rarity,
          weight,
          score,
          coins
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        scoreDate,
        normalizedPlayerId,
        province,
        normalizedFishId,
        normalizedFishName,
         normalizedRarity,
         normalizedWeight,
         normalizedScore,
         normalizedCoins,
        ],
      );
    await client.query(
      `
        insert into district_scores (score_date, province, score, updated_at)
        values ($1, $2, $3, now())
        on conflict (score_date, province)
        do update set
          score = district_scores.score + excluded.score,
          updated_at = now()
      `,
      [scoreDate, province, normalizedScore],
    );
    if (broadcastRarities.has(normalizedRarity)) {
      await client.query(
        `
          insert into broadcast_events (
            player_id,
            province,
            fish_id,
            fish_name,
            rarity
          ) values ($1, $2, $3, $4, $5)
        `,
        [normalizedPlayerId, province, normalizedFishId, normalizedFishName, normalizedRarity],
      );
    }
    await client.query('commit');
    response.status(201).json({ ok: true });
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
});

if (existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api\/).*/, (_request, response) => {
    response.sendFile(path.join(distDir, 'index.html'));
  });
}

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: 'server_error' });
});

app.listen(port, () => {
  console.log(`JOJOFISH leaderboard API listening on ${port}`);
});
