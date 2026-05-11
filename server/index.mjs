import cors from 'cors';
import express from 'express';
import pg from 'pg';

const { Pool } = pg;

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
app.use(express.json({ limit: '32kb' }));

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

const isValidDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);

app.get('/api/health', async (_request, response) => {
  await pool.query('select 1');
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
      with daily as (
        select
          player_id,
          count(*)::int as daily_catches,
          coalesce(sum(weight), 0)::float as daily_weight,
          coalesce(sum(score), 0)::int as daily_score
        from catch_events
        where score_date = $1
        group by player_id
      ),
      totals as (
        select
          player_id,
          count(*)::int as total_catches,
          coalesce(sum(weight), 0)::float as total_weight
        from catch_events
        group by player_id
      ),
      ranked as (
        select
          daily.player_id,
          daily.daily_catches,
          daily.daily_weight,
          daily.daily_score,
          coalesce(totals.total_catches, 0)::int as total_catches,
          coalesce(totals.total_weight, 0)::float as total_weight,
          row_number() over (
            order by daily.daily_weight desc, daily.daily_score desc, daily.daily_catches desc, daily.player_id asc
          )::int as rank
        from daily
        left join totals on totals.player_id = daily.player_id
      )
      select *
      from ranked
      where rank <= $2 or ($3 <> '' and player_id = $3)
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
    totalCasts: Number(row.total_catches),
    totalWeight: Number(row.total_weight),
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
  } = request.body ?? {};

  if (
    !isValidDate(scoreDate) ||
    typeof playerId !== 'string' ||
    !districts.includes(province) ||
    typeof fishId !== 'string' ||
    typeof fishName !== 'string' ||
    typeof rarity !== 'string' ||
    !Number.isFinite(Number(weight)) ||
    !Number.isFinite(Number(score))
  ) {
    response.status(400).json({ error: 'invalid_catch_payload' });
    return;
  }

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
          score
        ) values ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        scoreDate,
        playerId.slice(0, 32),
        province,
        fishId.slice(0, 64),
        fishName.slice(0, 64),
        rarity.slice(0, 24),
        Number(weight),
        Math.max(0, Math.round(Number(score))),
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
      [scoreDate, province, Math.max(0, Math.round(Number(score)))],
    );
    await client.query('commit');
    response.status(201).json({ ok: true });
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: 'server_error' });
});

app.listen(port, () => {
  console.log(`JOJOFISH leaderboard API listening on ${port}`);
});
