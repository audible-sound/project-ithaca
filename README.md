# Project Ithaca

Multi-agent B2B lead management system.

## Stack

| Area | Choice |
| --- | --- |
| Monorepo | pnpm workspaces + Turborepo |
| Frontend | React, TypeScript, Vite (`apps/web`) |
| Backend | Node.js, Express, TypeScript (`apps/api`) |
| Orchestrator | Co-located package (`packages/orchestrator`) imported by the API |
| Database | PostgreSQL 16 (Docker Compose, host port `5433`) |
| Agents / model / Exa / email | Stub packages under `packages/` |


## Prerequisites

- Node.js 22+
- [pnpm](https://pnpm.io/) 9 (`corepack enable` then `corepack prepare pnpm@9.15.0 --activate`)
- Docker (for Postgres)

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
- Health: http://localhost:3001/health

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

## Package map

```
apps/web            React UI
apps/api            Express API (health, workflow smoke route)
packages/shared     Shared types / DTOs
packages/db         Postgres pool + ping()
packages/orchestrator  Sequential lead workflow shell
packages/agents     identify / qualify / summarize / draft stubs
packages/ai-model   Model-layer stub (Gemini later)
packages/exa        Exa search client stub
packages/email      Gmail client stub
packages/tsconfig   Shared TypeScript configs
packages/eslint-config  Shared ESLint config
```