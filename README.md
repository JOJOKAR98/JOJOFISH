# JOJOFISH.COM MVP

## Version

Current release: v1.0.1. Future releases must bump `package.json` and `package-lock.json` before pushing.

## PostgreSQL storage

The player save, fish codex, regional leaderboard, player leaderboard modes, and server-wide broadcasts use a Node API plus PostgreSQL. The browser never connects to PostgreSQL directly. Browser localStorage is only kept as a fallback cache and first-run migration source.

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

The API health check returns PostgreSQL status at `/api/health`. Player saves are stored in `player_saves`; run `server/schema.sql` during deployment to create or update the table. The Node server can also serve the built frontend from `dist/`, so one process can host both the app and the PostgreSQL API when Nginx proxies to it.

For GitHub Actions deployment, set the repository secret `DATABASE_URL`. Optional secrets are `PGSSL`, `CORS_ORIGIN`, and `PORT`. The workflow writes the server `.env` file and runs `server/schema.sql` during deployment.

React + TypeScript + Tailwind CSS 鍗曢〉灏忔父鎴忓師鍨嬨€?
## 杩愯

```bash
npm install
npm run dev
```

## 宸插疄鐜?
- 鎶涚銆? 鍒?3 绉掔瓑寰呴奔璁€?0 绉掓媺鎵皬娓告垙
- 寮犲姏鏉°€佸畨鍏ㄥ尯銆佸嵄闄╁尯銆佹柇绾垮拰浣庡紶鍔涢€冭窇
- 鏀剁嚎銆佹斁绾裤€佸乏鎺с€佸彸鎺с€佺ǔ浣忔柟鍚戜簨浠?- 鏅€氶奔銆佺█鏈夐奔銆佹繁娴峰紓绉嶃€佹瘡鏃ラ殣钘忛奔鐜?- 寮傚父浜嬩欢銆佺壒娈婃捣鍩熴€侀噾甯併€佷綋鍔涖€佸垢杩愬姞鎴?- 楸肩璐拱鍜岃澶?- 鐪佷唤閫夋嫨銆佹ā鎷熸帓琛屾銆佸叏鏈嶅箍鎾?- 妯℃嫙骞垮憡鎭㈠浣撳姏銆佹瘡鏃ュ垢杩愩€佸け璐ュ悗浣庨澶嶆椿
- PostgreSQL save, with localStorage kept only as an offline fallback.

## 缁撴瀯

- `src/App.tsx`: 椤甸潰 UI銆佺姸鎬佹祦杞€佹媺鎵皬娓告垙寰幆
- `src/data/gameData.ts`: 鐪佷唤銆侀奔銆侀奔绔裤€佹捣鍩熴€佸紓甯镐簨浠堕厤缃?- `src/lib/game.ts`: 姒傜巼銆佹瘡鏃ラ奔鐜嬨€佸瓨妗ｉ粯璁ゅ€笺€佹帓琛屾宸ュ叿
- `src/types.ts`: 鏍稿績绫诲瀷
- `src/index.css`: 娴烽潰銆侀粦褰便€侀渿鍔ㄣ€佹按鑺便€侀噾甯佸弽棣?
