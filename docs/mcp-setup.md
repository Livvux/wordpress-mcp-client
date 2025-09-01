# MCP Setup (WordPress)

This OSS edition relies on a WordPress MCP plugin running on your site. The app calls MCP tools via that plugin.

## Install the WordPress MCP plugin

- Install and activate the plugin from its release page (example):
  - https://github.com/Automattic/wordpress-mcp
- Ensure pretty permalinks are enabled.

## Endpoint & Token

- Endpoint (default): `https://your-site.com/wp-json/wp/v2/wpmcp/streamable`
- Token: Issue a JWT/App Password per the plugin’s documentation. Keep it secret.

## Validate from the app

- In the Setup wizard, enter your Site URL and JWT token and run “Test Connection”.
- In OSS mode, validation is a no‑op success; use the plugin’s own test endpoints to confirm connectivity if needed.

## Test with curl

```bash
curl -i \
  -H 'Authorization: Bearer <JWT>' \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"initialize","id":"1"}' \
  https://your-site.com/wp-json/wp/v2/wpmcp/streamable
```

You should receive a JSON‑RPC style response from the plugin.

## Security Notes

- Never commit your JWT. Store it securely and rotate regularly.
- Consider staging sites for experimentation.

