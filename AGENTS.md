# Repository Guidelines

## Project Structure & Module Organization
- `app/`: Next.js App Router (layouts, routes, API).
- `components/`, `hooks/`: Reusable UI and React hooks.
- `lib/`: Client/server utilities; `lib/db/` (Drizzle + migrations), `lib/ai/`, `lib/mcp/`.
- `public/`: Static assets. `artifacts/`: generated outputs (code/image/text).
- `tests/`: Playwright e2e and route tests. `docker-compose.yml`: local Postgres.

## Build, Test, and Development Commands
- `pnpm dev`: Run Next.js dev server.
- `pnpm build`: Run DB migrations, then build the app.
- `pnpm start`: Start production server after build.
- `pnpm test`: Run Playwright tests (spawns dev server).
- `pnpm lint` / `pnpm lint:fix`: ESLint + Biome lint (fix on `:fix`).
- `pnpm format`: Format code with Biome.
- DB: `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:studio`.

## Coding Style & Naming Conventions
- Language: TypeScript; indent: 2 spaces; line endings: LF (Biome enforced).
- Quotes: single; trailing commas: all; semicolons: always.
- Filenames: kebab-case (e.g., `chat-header.tsx`); React component exports in PascalCase.
- Linting: ESLint `next/core-web-vitals` + Tailwind plugin; Biome is the formatting source of truth.

## Testing Guidelines
- Framework: Playwright; tests live under `tests/` (e.g., `tests/e2e/*.test.ts`).
- Run all: `pnpm test`. Single file: `pnpm exec playwright test tests/e2e/chat.test.ts`.
- Config: `playwright.config.ts` (HTML reporter; `baseURL` auto-wired to dev server).
- Use fixtures in `tests/fixtures.ts` for authenticated contexts.

## Commit & Pull Request Guidelines
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`) with clear scope.
- PRs must include: problem/solution summary, linked issues, and UI screenshots when applicable.
- Before opening a PR: ensure `pnpm format && pnpm lint && pnpm test` pass locally.

## Security & Configuration Tips
- Copy `.env` to `.env.local`; set `POSTGRES_URL`, `NEXTAUTH_SECRET`, and provider keys.
- Start Postgres locally: `docker compose up -d`, then `pnpm db:migrate`.
- Never commit secrets; keep `.env*` local. Use `BLOB_*`, AI provider keys, and `REDIS_URL` only via environment variables.

