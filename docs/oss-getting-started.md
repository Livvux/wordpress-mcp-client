# OSS Light Edition — Getting Started

This edition runs without authentication and without a database. It uses a single local session and manual MCP configuration.

## Run

1) Copy env

```bash
cp .env.oss.example .env.local
```

2) Configure WordPress MCP

See docs/mcp-setup.md to install and validate the plugin on your WordPress site.

3) Start dev

```bash
pnpm dev
```

## Behavior

- No DB/Auth. Session stays in the browser only.
- REST endpoints return stubbed responses where applicable.
- Configure your WordPress MCP plugin manually and use the UI to validate.

## Switching back to Premium locally

```bash
git checkout main
cp .env.example .env.local
pnpm db:ensure && pnpm db:migrate
pnpm dev
```
