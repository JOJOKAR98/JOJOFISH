import cors from 'cors';
import crypto from 'node:crypto';
import express from 'express';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';
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
const feishuBotEnabled = Boolean(process.env.FEISHU_APP_ID && process.env.FEISHU_APP_SECRET && process.env.OPENAI_API_KEY);

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
const openai = feishuBotEnabled ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const feishuConversations = new Map();
let cachedTenantToken = null;
let cachedTenantTokenExpiresAt = 0;

const isValidDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const normalizePlayerId = (value) => (typeof value === 'string' ? value.trim().slice(0, 32) : '');
const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

const feishuApi = async (path, init = {}) => {
  const response = await fetch(`https://open.feishu.cn/open-apis${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...init.headers,
    },
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || data?.code !== 0) {
    throw new Error(`Feishu API failed ${response.status}: ${JSON.stringify(data)}`);
  }
  return data;
};

const getTenantAccessToken = async () => {
  if (cachedTenantToken && Date.now() < cachedTenantTokenExpiresAt) return cachedTenantToken;

  const data = await feishuApi('/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    body: JSON.stringify({
      app_id: process.env.FEISHU_APP_ID,
      app_secret: process.env.FEISHU_APP_SECRET,
    }),
  });

  cachedTenantToken = data.tenant_access_token;
  cachedTenantTokenExpiresAt = Date.now() + Math.max(60, Number(data.expire ?? 7200) - 300) * 1000;
  return cachedTenantToken;
};

const sendFeishuTextMessage = async (receiveId, text, receiveIdType = 'open_id') => {
  const token = await getTenantAccessToken();
  await feishuApi(`/im/v1/messages?receive_id_type=${encodeURIComponent(receiveIdType)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      receive_id: receiveId,
      msg_type: 'text',
      content: JSON.stringify({ text }),
    }),
  });
};

const decryptFeishuPayload = (encrypt) => {
  if (!process.env.FEISHU_ENCRYPT_KEY) {
    throw new Error('FEISHU_ENCRYPT_KEY is required for encrypted callbacks');
  }

  const key = crypto.createHash('sha256').update(process.env.FEISHU_ENCRYPT_KEY).digest();
  const encrypted = Buffer.from(encrypt, 'base64');
  const iv = encrypted.subarray(0, 16);
  const ciphertext = encrypted.subarray(16);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
};

const getFeishuEventBody = (body) => {
  if (body.encrypt) return decryptFeishuPayload(body.encrypt);
  return body;
};

const verifyFeishuCallback = (body) => {
  const token = process.env.FEISHU_VERIFICATION_TOKEN;
  if (!token) return true;
  return body.token === token || body.header?.token === token;
};

const getFeishuMessageText = (message) => {
  if (message?.message_type !== 'text') return '';
  try {
    return JSON.parse(message.content ?? '{}').text?.trim() ?? '';
  } catch {
    return '';
  }
};

const askFeishuOpenAI = async (conversationKey, userText) => {
  if (!openai) return '机器人已连通，但服务器还没有配置 OPENAI_API_KEY / FEISHU_APP_ID / FEISHU_APP_SECRET。';

  const history = feishuConversations.get(conversationKey) ?? [];
  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    input: [
      {
        role: 'system',
        content: '你是部署在飞书里的工程助手。回答简洁、可执行；没有工具权限时，要说明需要接入执行工具或让用户确认环境。',
      },
      ...history,
      { role: 'user', content: userText },
    ],
  });

  const reply = response.output_text?.trim() || '我收到了，但这次没有生成有效回复。';
  feishuConversations.set(conversationKey, [...history, { role: 'user', content: userText }, { role: 'assistant', content: reply }].slice(-12));
  return reply;
};

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
      with saved_players as (
        select
          player_id,
          player_state,
          updated_at
        from player_saves
      ),
      event_totals as (
        select
          player_id,
          count(*) filter (where score_date = $1)::int as daily_catches,
          coalesce(sum(weight) filter (where score_date = $1), 0)::float as daily_weight,
          coalesce(sum(score) filter (where score_date = $1), 0)::int as daily_score,
          coalesce(sum(coins) filter (where score_date = $1), 0)::int as daily_coins,
          count(*)::int as total_catches,
          coalesce(sum(weight), 0)::float as total_weight,
          coalesce(sum(coins), 0)::int as total_coins,
          max(created_at) as last_catch_at
        from catch_events
        group by player_id
      ),
      player_base as (
        select player_id from saved_players
        union
        select player_id from event_totals
        union
        select $3::text as player_id where $3 <> ''
      ),
      player_totals as (
        select
          player_base.player_id,
          greatest(
            coalesce(event_totals.daily_catches, 0),
            case
              when saved_players.player_state ->> 'statsDate' = $1::text
                then coalesce((saved_players.player_state ->> 'dailyCasts')::int, 0)
              else 0
            end
          )::int as daily_catches,
          greatest(
            coalesce(event_totals.daily_weight, 0),
            case
              when saved_players.player_state ->> 'statsDate' = $1::text
                then coalesce((saved_players.player_state ->> 'dailyWeight')::float, 0)
              else 0
            end
          )::float as daily_weight,
          coalesce(event_totals.daily_score, 0)::int as daily_score,
          greatest(
            coalesce(event_totals.daily_coins, 0),
            case
              when saved_players.player_state ->> 'statsDate' = $1::text
                then coalesce((saved_players.player_state ->> 'dailyCoins')::int, 0)
              else 0
            end
          )::int as daily_coins,
          greatest(coalesce(event_totals.total_catches, 0), coalesce((saved_players.player_state ->> 'totalCasts')::int, 0))::int as total_catches,
          greatest(coalesce(event_totals.total_weight, 0), coalesce((saved_players.player_state ->> 'totalWeight')::float, 0))::float as total_weight,
          greatest(coalesce(event_totals.total_coins, 0), coalesce((saved_players.player_state ->> 'totalCoins')::int, 0))::int as total_coins,
          coalesce(saved_players.updated_at, event_totals.last_catch_at) as last_active_at
        from player_base
        left join saved_players on saved_players.player_id = player_base.player_id
        left join event_totals on event_totals.player_id = player_base.player_id
      ),
      candidates as (
        (select player_id from player_totals order by daily_weight desc, daily_score desc, daily_catches desc, total_catches desc, last_active_at desc nulls last, player_id asc limit $2)
        union
        (select player_id from player_totals order by daily_coins desc, daily_score desc, daily_weight desc, total_coins desc, last_active_at desc nulls last, player_id asc limit $2)
        union
        (select player_id from player_totals order by total_catches desc, total_weight desc, last_active_at desc nulls last, player_id asc limit $2)
        union
        (select player_id from player_totals order by total_coins desc, total_weight desc, last_active_at desc nulls last, player_id asc limit $2)
        union
        (select $3::text as player_id where $3 <> '')
      ),
      ranked as (
        select
          player_totals.*,
          row_number() over (
            order by daily_weight desc, daily_score desc, daily_catches desc, total_catches desc, last_active_at desc nulls last, player_totals.player_id asc
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

app.post('/feishu/events', async (request, response, next) => {
  try {
    const body = getFeishuEventBody(request.body);

    if (body.type === 'url_verification') {
      if (!verifyFeishuCallback(body)) {
        response.status(401).json({ error: 'invalid_verification_token' });
        return;
      }
      response.json({ challenge: body.challenge });
      return;
    }

    if (!verifyFeishuCallback(body)) {
      response.status(401).json({ error: 'invalid_verification_token' });
      return;
    }

    response.json({ ok: true });

    const eventType = body.header?.event_type;
    if (eventType !== 'im.message.receive_v1') return;

    const event = body.event;
    const messageText = getFeishuMessageText(event?.message);
    const senderOpenId = event?.sender?.sender_id?.open_id;
    const conversationKey = event?.message?.chat_id || senderOpenId || 'default';

    if (!messageText || !senderOpenId) return;
    const reply = await askFeishuOpenAI(conversationKey, messageText);
    await sendFeishuTextMessage(senderOpenId, reply);
  } catch (error) {
    next(error);
  }
});

if (existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api\/|\/feishu\/).*/, (_request, response) => {
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
