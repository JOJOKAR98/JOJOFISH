import crypto from 'node:crypto';
import express from 'express';
import OpenAI from 'openai';

const {
  FEISHU_APP_ID,
  FEISHU_APP_SECRET,
  FEISHU_VERIFICATION_TOKEN,
  FEISHU_ENCRYPT_KEY,
  OPENAI_API_KEY,
  OPENAI_MODEL = 'gpt-4.1-mini',
  BOT_PORT = '8790',
} = process.env;

if (!FEISHU_APP_ID || !FEISHU_APP_SECRET || !OPENAI_API_KEY) {
  throw new Error('FEISHU_APP_ID, FEISHU_APP_SECRET, and OPENAI_API_KEY are required');
}

const app = express();
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const conversations = new Map();

app.use(express.json({ limit: '1mb' }));

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

let cachedTenantToken = null;
let cachedTenantTokenExpiresAt = 0;

const getTenantAccessToken = async () => {
  if (cachedTenantToken && Date.now() < cachedTenantTokenExpiresAt) {
    return cachedTenantToken;
  }

  const data = await feishuApi('/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    body: JSON.stringify({
      app_id: FEISHU_APP_ID,
      app_secret: FEISHU_APP_SECRET,
    }),
  });

  cachedTenantToken = data.tenant_access_token;
  cachedTenantTokenExpiresAt = Date.now() + Math.max(60, Number(data.expire ?? 7200) - 300) * 1000;
  return cachedTenantToken;
};

const sendTextMessage = async (receiveId, text, receiveIdType = 'open_id') => {
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
  if (!FEISHU_ENCRYPT_KEY) {
    throw new Error('FEISHU_ENCRYPT_KEY is required for encrypted callbacks');
  }

  const key = crypto.createHash('sha256').update(FEISHU_ENCRYPT_KEY).digest();
  const encrypted = Buffer.from(encrypt, 'base64');
  const iv = encrypted.subarray(0, 16);
  const ciphertext = encrypted.subarray(16);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
};

const getEventBody = (body) => {
  if (body.encrypt) return decryptFeishuPayload(body.encrypt);
  return body;
};

const verifyCallback = (body) => {
  if (!FEISHU_VERIFICATION_TOKEN) return true;
  return body.token === FEISHU_VERIFICATION_TOKEN || body.header?.token === FEISHU_VERIFICATION_TOKEN;
};

const getMessageText = (message) => {
  if (message.message_type !== 'text') return '';
  try {
    return JSON.parse(message.content ?? '{}').text?.trim() ?? '';
  } catch {
    return '';
  }
};

const buildConversationKey = (event) => {
  const chatId = event.message?.chat_id;
  const senderId = event.sender?.sender_id?.open_id;
  return chatId || senderId || 'default';
};

const askOpenAI = async (conversationKey, userText) => {
  const history = conversations.get(conversationKey) ?? [];
  const input = [
    {
      role: 'system',
      content:
        '你是一个部署在飞书里的工程助手。回答要简洁、可执行；如果用户要求修改代码、部署或访问私有系统，而你没有对应工具权限，要说明需要接入执行工具或让用户确认执行环境。',
    },
    ...history,
    { role: 'user', content: userText },
  ];

  const response = await openai.responses.create({
    model: OPENAI_MODEL,
    input,
  });

  const reply = response.output_text?.trim() || '我收到了，但这次没有生成有效回复。';
  conversations.set(conversationKey, [...history, { role: 'user', content: userText }, { role: 'assistant', content: reply }].slice(-12));
  return reply;
};

app.get('/health', (_request, response) => {
  response.json({ ok: true });
});

app.post('/feishu/events', async (request, response, next) => {
  try {
    const body = getEventBody(request.body);

    if (body.type === 'url_verification') {
      if (!verifyCallback(body)) {
        response.status(401).json({ error: 'invalid_verification_token' });
        return;
      }
      response.json({ challenge: body.challenge });
      return;
    }

    if (!verifyCallback(body)) {
      response.status(401).json({ error: 'invalid_verification_token' });
      return;
    }

    response.json({ ok: true });

    const eventType = body.header?.event_type;
    if (eventType !== 'im.message.receive_v1') return;

    const event = body.event;
    const messageText = getMessageText(event.message);
    const senderOpenId = event.sender?.sender_id?.open_id;

    if (!messageText || !senderOpenId) return;
    const reply = await askOpenAI(buildConversationKey(event), messageText);
    await sendTextMessage(senderOpenId, reply);
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  console.error(error);
  if (!response.headersSent) {
    response.status(500).json({ error: 'bot_server_error' });
  }
});

app.listen(Number(BOT_PORT), () => {
  console.log(`Feishu OpenAI bot listening on ${BOT_PORT}`);
});
