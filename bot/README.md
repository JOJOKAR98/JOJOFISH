# Feishu OpenAI Bot

This service lets a Feishu bot receive text messages and reply with OpenAI.

It is a bridge for chat and task intake. It does not directly control a Codex desktop session. To let Feishu commands deploy code or run project scripts, add explicit server-side tools after the basic bot is stable.

## 1. Create The Feishu App

1. Open the Feishu/Lark developer console and create an internal app.
2. Add bot capability.
3. Enable event subscription for message receive events:
   - `im.message.receive_v1`
4. Add bot permissions:
   - receive messages
   - send messages as bot
5. Copy the app credentials:
   - `App ID`
   - `App Secret`
   - verification token
   - encrypt key, if callback encryption is enabled

Set the event request URL to:

```text
https://YOUR_DOMAIN/feishu/events
```

For local testing, expose the bot port with a tunnel such as Cloudflare Tunnel or ngrok, then use the public HTTPS URL.

## 2. Environment Variables

```bash
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=xxx
FEISHU_VERIFICATION_TOKEN=xxx
FEISHU_ENCRYPT_KEY=xxx
OPENAI_API_KEY=sk-xxx
OPENAI_MODEL=gpt-4.1-mini
BOT_PORT=8790
```

`FEISHU_ENCRYPT_KEY` is only required when Feishu callback encryption is enabled.

## 3. Run

Install dependencies first:

```bash
npm install
npm run bot
```

Health check:

```bash
curl http://127.0.0.1:8790/health
```

## 4. Production Notes

Run this bot as a separate process from the game API. With Nginx, proxy only the callback path:

```nginx
location /feishu/ {
  proxy_pass http://127.0.0.1:8790/feishu/;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
}
```

For Feishu to call the bot, the URL must be reachable over HTTPS.

## 5. Next Tooling Ideas

After the basic bot works, add explicit commands such as:

- `/status`: check deployment health
- `/deploy main`: run a controlled deployment script
- `/build`: trigger `npm run build`
- `/issue`: create a GitHub issue from a Feishu message

Keep destructive commands behind allowlists and confirmation.
