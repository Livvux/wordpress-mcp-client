=== WP Cursor (Skeleton) ===
Contributors: wpAgent
Requires at least: 6.1
Tested up to: 6.6
Stable tag: 0.1.0
Requires PHP: 8.1
License: GPLv2 or later

Minimal skeleton for WP Cursor REST API (Phase 1).

== Description ==
Provides read-only endpoints under /wp-json/wpcursor/v1:
- GET /health – health check
- POST /auth/token – stub token issuance (scoped JWT placeholder)
- GET /posts – list recent posts
- GET /logs/tail – SSE stub emitting a single ping

MCP (JSON-RPC via /wp-json/wp/v2/wpmcp/streamable) exposes tools:
- posts.list, posts.get, logs.tail, files.read

Admin Console (Tools → WP Cursor):
- Generate short-lived tokens with scopes (posts:read, files:read)

Admin Console (Tools → WP Cursor):
- Issue tokens manually for local testing
- Connect to App flow: enter App URL (e.g. http://localhost:3000) to generate a short‑lived token and redirect to the app’s accept endpoint. No need to paste Site URL or JWT into the app.
- Pair with App via Device Code: generate a pairing code in the app and enter it here with the App URL; the plugin will submit a short‑lived token to the app. Complete the link in the app. No token copy/paste required.
- View recent signed audit log entries

This is a development scaffold. Do not use in production as-is.

== Changelog ==
= 0.1.0 =
* Initial skeleton with admin console, signed audit log, and files.read tool.
