WP Connector (MCP Server) — Skeleton

Purpose: Bridge the app to the WordPress plugin over REST/SSE via standardized MCP tools. Phase 1 focuses on read-only tools.

Status: Skeleton only. TODO to implement a Node MCP server exposing tools like posts.list, files.read, logs.tail by proxying to the WP plugin.

Suggested stack: TypeScript, fastify/express, minimal MCP transport.

