# OSS Configuration

Copy `.env.oss.example` to `.env.local` and adjust if needed.

Required defaults for OSS:

- `APP_MODE=oss`
- `AUTH_ENABLED=false`
- `DB_ENABLED=false`

Optional:

- `AI_DEFAULT_PROVIDER` (e.g., `openai`)
- `AI_DEFAULT_MODEL` (e.g., `gpt-4o-mini`)
- `FIRECRAWL_API_URL`, `FIRECRAWL_API_KEY`
- `NEXT_PUBLIC_ENABLE_SUGGESTED_ACTIONS` (set to `false` to hide the four quick suggestions above the chat input)

Notes:

- In OSS mode, authentication and database are disabled; the app uses a single local browser session.
- REST endpoints for posts/media are stubs for demonstration. Use the WordPress MCP plugin for actual actions.
