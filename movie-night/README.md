# Movie Night (Jellyfin voting) - Starter Skeleton

## Requirements
- Node 18+ (or 20+)
- Docker + Docker Compose (optional for prod-ish run)

## Dev (recommended)
### API
cd api
npm i
npm run dev

### Web
cd web
npm i
npm run dev

- API: http://localhost:3000/health
- Web: http://localhost:5173 (proxies /api -> API)

## Prod-ish via Docker
docker compose up --build

- Web: http://localhost:8080
- API: http://localhost:3000 (internal; also mapped for convenience)
