# Project Ithaca

Multi-agent B2B lead management system.

## Stack

| Area | Choice |
| --- | --- |
| Monorepo | pnpm workspaces + Turborepo |
| Frontend | React, TypeScript, Vite, Zustand (`apps/web`) |
| Backend | Node.js, Express, TypeScript (`apps/api`) |
| Orchestrator | Co-located package (`packages/orchestrator`) imported by the API |
| Database | PostgreSQL 16 with Drizzle (`packages/db`, Docker Compose, host port `5433`) |
| Email catcher | Mailpit (Docker Compose, SMTP `127.0.0.1:1025`, inbox `127.0.0.1:8025`) |
| Agents / model / Exa | Packages under `packages/` |


## Prerequisites

- Node.js 22+
- [pnpm](https://pnpm.io/) 9 (`corepack enable` then `corepack prepare pnpm@9.15.0 --activate`)
- Docker (for Postgres and Mailpit)

## Quick start

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm build
pnpm dev
```

- Web: http://localhost:5173
- API: http://localhost:3001
- Mailpit inbox: http://127.0.0.1:8025

On a hosted deploy where the API runs in Compose next to Mailpit, set `SMTP_HOST=mailpit`, keep port `1025` on the private network only, and set `MP_UI_AUTH_FILE` before exposing the inbox.

## Workflow

1. Create a branch from `main` for any new work
2. Add commits to the branch
3. Open a pull request
4. Review, test, and make changes as needed
5. Merge to `main` when approved
6. Deploy immediately after merging to `main`

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Run web + API (builds dependency packages first) |
| `pnpm build` | Build all packages and apps |
| `pnpm typecheck` | Typecheck the workspace |
| `pnpm lint` | Lint the workspace |
| `pnpm clean` | Remove build outputs |
| `pnpm db:generate` | Write SQL migrations from the Drizzle schema |
| `pnpm db:migrate` | Apply committed migrations to Postgres |
| `pnpm db:seed` | Run numbered database seeders in order |

## Package map

```
apps/web            React UI
apps/api            Express API (auth, profiles)
packages/shared     Shared types / DTOs
packages/db         Drizzle client on the Postgres pool
packages/security   Password hashing and token signing
packages/orchestrator  Sequential lead workflow shell
packages/agents     identify / qualify / summarize / draft stubs
packages/ai-model   Model-layer stub (Gemini later)
packages/exa        Exa search client stub
packages/email      SMTP client (Mailpit in local Docker)
packages/tsconfig   Shared TypeScript configs
packages/eslint-config  Shared ESLint config
```