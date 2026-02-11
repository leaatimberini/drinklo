# ERP Monorepo Setup (Windows)

## Prerequisites
- Node.js 24.x
- pnpm 9.x
- Docker Desktop (for Postgres + Redis)

## 1) Install dependencies
```powershell
pnpm install
```

## 2) Start local infraestructura (Postgres + Redis)
```powershell
docker compose up -d
```

## 3) Configure environment variables
Copy each example file and fill values:
- apps/api/.env.example -> apps/api/.env
- apps/admin/.env.example -> apps/admin/.env
- apps/storefront/.env.example -> apps/storefront/.env
- apps/bot/.env.example -> apps/bot/.env

## 4) Prisma (optional for local DB)
```powershell
pnpm -C packages/db generate
pnpm -C packages/db migrate
```

## 5) Run everything (Turbo)
```powershell
pnpm dev
```

Apps run on:
- API: http://localhost:3001
- Admin: http://localhost:3002
- Storefront: http://localhost:3003
- Bot: runs in terminal

## Useful scripts
```powershell
pnpm lint
pnpm test
pnpm build
pnpm format
```
