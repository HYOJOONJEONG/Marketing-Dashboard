# v0-h4-lab-steem-keychain-redesign

This is a [Next.js](https://nextjs.org) project bootstrapped with [v0](https://v0.app).

## Built with v0

This repository is linked to a [v0](https://v0.app) project. You can continue developing by visiting the link below -- start new chats to make changes, and v0 will push commits directly to this repo. Every merge to `main` will automatically deploy.

[Continue working on v0 →](https://v0.app/chat/projects/prj_lNYcPshyX7b8bCEZtadh6b9mjava)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Shared DB (Local + URL Sync)

This project supports a shared key-value DB for dashboard state and option data.

- DB keys:
  - `dashboard_state`
  - dashboard slices such as `dashboard_contracts`, `dashboard_collection`, `dashboard_termination`
  - `options_mock`
- Storage:
  - Local mode: JSON file (`data/shared-kv-store.json`)
  - Production mode: Vercel KV, Upstash Redis, or a central API (`/api/shared-kv`)
- Read behavior:
  - The app reads the full dashboard state first.
  - If changed slices exist, those slices are overlaid on top of the full state.
  - This keeps refreshes stable while avoiding overwriting unrelated data.

### Environment Variables

- `SHARED_DB_PATH`
  - Optional local folder or JSON path (default: `data/shared-kv-store.json`)
- `CENTRAL_DB_API_URL`
  - If set, read/write will call `<url>/api/shared-kv`
- `CENTRAL_DB_API_TOKEN`
  - Token sent as `x-central-token`
- `SHARED_KV_API_KEY`
  - Preferred server API key for `/api/shared-kv`
  - Accepted as `x-api-key` or `Authorization: Bearer <key>`
  - Browser users can still access the route through normal login session
- `CENTRAL_DB_SOURCE`
  - Writer identity shown in audit log (example: `local-dev`, `vercel-prod`)
- `SHARED_DB_REQUIRE_CENTRAL`
  - `1`이면 중앙 API 미설정 시 실행 중단(원복/분기 저장 방지)
- `SHARED_DB_ALLOW_SEED`
  - `1`이면 fallback 파일로 초기 seed 허용
  - 운영 환경에서는 `0` 권장

### Recommended setup

1. Choose one central server (for example Contabo) and run this app there.
2. On that server, keep `CENTRAL_DB_API_URL` empty and let it own `data/shared-kv-store.json` or Redis/KV.
3. On Vercel/local clients, set:
   - `CENTRAL_DB_API_URL=https://<central-host>`
   - `CENTRAL_DB_API_TOKEN=<same token as central server>`
   - `SHARED_KV_API_KEY=<same token as central server>`
   - `SHARED_DB_REQUIRE_CENTRAL=1`
   - `SHARED_DB_ALLOW_SEED=0`
4. Then all clients read/write the same central DB.
5. If the central DB is not ready yet, temporarily set `SHARED_DB_REQUIRE_CENTRAL=0` so the app can still boot from bundled fallback data.

### `.env` template files

- `.env.local.example`
  - 로컬 단독 개발용
- `.env.central-server.example`
  - 중앙 DB 서버(Contabo)용
- `.env.vercel.example`
  - Vercel 클라이언트(중앙 API 연결)용

복사 예시:

```bash
cp .env.central-server.example .env
```

또는 Windows:

```powershell
Copy-Item .env.central-server.example .env
```

## Learn More

To learn more, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [v0 Documentation](https://v0.app/docs) - learn about v0 and how to use it.

<a href="https://v0.app/chat/api/kiro/clone/HYOJOONJEONG/v0-h4-lab-steem-keychain-redesign" alt="Open in Kiro"><img src="https://pdgvvgmkdvyeydso.public.blob.vercel-storage.com/open%20in%20kiro.svg?sanitize=true" /></a>
