# JOJOFISH.COM MVP

## Version

Current release: v1.0.0. Future releases must bump `package.json` and `package-lock.json` before pushing.

## PostgreSQL leaderboard

The regional leaderboard, player leaderboard modes, and server-wide broadcasts use a Node API plus PostgreSQL. The browser never connects to PostgreSQL directly.

```bash
psql "$DATABASE_URL" -f server/schema.sql
DATABASE_URL="postgres://user:password@127.0.0.1:5432/jojofish" PORT=8787 npm run server
```

Frontend config:

```bash
VITE_LEADERBOARD_API_URL=/api
```

If the API is on another domain, use `VITE_LEADERBOARD_API_URL=https://your-domain.com/api`.

Production server setup:

```bash
cd /var/www/jojofish.wakaka007.cn/current
export DATABASE_URL="postgres://user:password@127.0.0.1:5432/jojofish"
export PGSSL=false
psql "$DATABASE_URL" -f server/schema.sql
npm ci --omit=dev
npm run server
```

The API health check returns PostgreSQL status at `/api/health`. The Node server can also serve the built frontend from `dist/`, so one process can host both the app and the PostgreSQL API when Nginx proxies to it.

For GitHub Actions deployment, set the repository secret `DATABASE_URL`. Optional secrets are `PGSSL`, `CORS_ORIGIN`, and `PORT`. The workflow writes the server `.env` file and runs `server/schema.sql` during deployment.

React + TypeScript + Tailwind CSS 单页小游戏原型。

## 运行

```bash
npm install
npm run dev
```

## 已实现

- 抛竿、1 到 3 秒等待鱼讯、10 秒拉扯小游戏
- 张力条、安全区、危险区、断线和低张力逃跑
- 收线、放线、左控、右控、稳住方向事件
- 普通鱼、稀有鱼、深海异种、每日隐藏鱼王
- 异常事件、特殊海域、金币、体力、幸运加成
- 鱼竿购买和装备
- 省份选择、模拟排行榜、全服广播
- 模拟广告恢复体力、每日幸运、失败后低频复活
- localStorage 存档

## 结构

- `src/App.tsx`: 页面 UI、状态流转、拉扯小游戏循环
- `src/data/gameData.ts`: 省份、鱼、鱼竿、海域、异常事件配置
- `src/lib/game.ts`: 概率、每日鱼王、存档默认值、排行榜工具
- `src/types.ts`: 核心类型
- `src/index.css`: 海面、黑影、震动、水花、金币反馈
