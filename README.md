<h1 align="center">wpAgentic — OSS (Lite)</h1>

Self‑hostable Chat UI to assist with WordPress via MCP (Model Context Protocol). This OSS edition runs without database or authentication, keeps sessions local in the browser, and integrates with a WordPress MCP plugin for actions.

- Docs: docs/oss-getting-started.md
- MCP Setup: docs/mcp-setup.md
- Configuration: docs/oss-config.md

## Features (OSS Lite)

- Next.js App Router + AI SDK UI components
- MCP‑based WordPress interaction (via external WP MCP plugin)
- Local session only (no DB, no auth)
- Optional REST stubs for validation/preview

Not included in OSS:
- Premium features (Stripe billing, multi‑site management, file patching, WP‑CLI, audit logs).

## Quickstart

```bash
pnpm install
cp .env.oss.example .env.local
pnpm dev
```

Then open http://localhost:3000 and follow the Setup wizard. Install and configure the WordPress MCP plugin on your site (see docs/mcp-setup.md), then validate the connection.

## Configuration

See docs/oss-config.md for environment variables. Defaults:

- `APP_MODE=oss`
- `AUTH_ENABLED=false`
- `DB_ENABLED=false`

Optional:

- `AI_DEFAULT_PROVIDER` and `AI_DEFAULT_MODEL`
- `FIRECRAWL_API_URL` and `FIRECRAWL_API_KEY`

## Deploy

You can deploy to any Node.js host (Vercel, Fly.io, Render, etc.). Ensure `.env.local` mirrors `.env.oss.example`.

```bash
pnpm build
pnpm start
```

## Limitations (OSS)

- No server‑side persistence; all secrets should be handled via the WordPress MCP plugin.
- REST endpoints for posts/media are stubs; production‑grade writes require the Premium edition and plugin.
- Single session/site.

## Premium Edition

The Premium edition (private branch) adds:

- Stripe‑based subscriptions and gating
- Multi‑site management
- WordPress plugin with: file diff/apply (atomic rollback), WP‑CLI proxy, audit log, SSE logs, approvals

We keep Premium and OSS separated by Git branches/repos. See docs/architecture_plan.md for the full roadmap.

## License

This repository is open‑source under the existing LICENSE file.
