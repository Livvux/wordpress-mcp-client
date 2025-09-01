# WP Cursor — Architecture & Implementation Plan (v0.1)

**Goal in one sentence:**
A hybrid **Desktop/Web app + WordPress plugin** that gives you a Cursor‑style, AI‑assisted IDE for WordPress with **safe capabilities** (content, files, WP‑CLI, Git), **approval gates**, **diff & rollback**, and **local sandbox runs**.

---

## 1) Architecture Decision (TL;DR)
**Do both:**
- **A. WordPress Plugin (`wp-cursor`)**
  - Hardened API surface + Webhooks + in‑WP admin console.
  - Provides capabilities, auth scopes, audit log, and a server‑side patch applier.
- **B. Standalone App ("WP Cursor" Desktop/Web)**
  - Next.js app with Cursor‑like UX: editor, chat, diff review, Git panel.
  - Hosts an **MCP client** talking to multiple tools (wp‑connector, wp‑cli, git, lighthouse, n8n, etc.).

**Why hybrid?** The plugin sits next to the system for real authority (WP‑CLI, FS writes, hooks); the app delivers first‑class developer UX, multi‑site control, and strong security isolation.

---

## 2) Component Overview
```
[User]
  └─ WP Cursor App (Next.js + Tauri/Electron)
        ├─ Chat + Editor + Diff/Review + Git Panel
        ├─ MCP Client  ────────────────┐
        │                              │
        ├─ LLM Router (cloud/local)    │
        └─ Secrets Vault               │
                                       │
[MCP Servers/Tools]                    │
  ├─ wp-connector  → talks to WP plugin (REST/WS)
  ├─ wp-cli       → SSH WP-CLI exec + log streaming
  ├─ git          → branches, commits, PRs
  ├─ browserless/lighthouse → perf, screenshots
  ├─ n8n/queues   → long-running jobs
  └─ search/index → embeddings, KB
                                       │
[WordPress Site]
  ├─ wp-cursor Plugin
  │    ├─ REST API + WS (scoped)
  │    ├─ Patch Engine (apply/revert)
  │    ├─ Capability Gates + Approvals
  │    ├─ Audit Log (signed)
  │    └─ Git Hook (optional)
  └─ WP Core/Plugins/Themes/DB/FS
```

---

## 3) Protocols & Interfaces
- **MCP (Model Context Protocol)** standardizes tool calls between the app and tools.
- **WP Plugin API:** **REST** for requests, **WebSocket/SSE** for logs, events, and progress.
- **WP‑CLI:** execute via **SSH** (never shell out from PHP); wrapped as an MCP tool with whitelist & approvals.
- **Git:** separate MCP tool (local or remote provider adapter).
- **Transport:** HTTPS, short‑lived signed tokens/nonces, optional mTLS, per‑scope tokens.

---

## 4) Security Model (non‑negotiable)
- **Scoped permissions** per site: `posts:read`, `fs:write`, `wpcli:read`, `plugins:manage`, etc.
- **Approval gates** for destructive actions (file writes, DB migrations, plugin activation). Always show **plan → diff → approve**.
- **Dry‑run & static checks** before writes (syntax, PHPCS, psalm/phpstan).
- **Atomic apply**: patch bundle → backup snapshot → write → cache purge → smoke tests → auto‑rollback on failure.
- **Backups**: files (touched paths) + selected DB tables.
- **Secrets Vault** lives in the app, never in WP DB (tokens, SSH keys).
- **Audit log**: append‑only, signed entries.

---

## 5) Capabilities (v1 set)
**Content & Config**
- Posts/pages/CPT: get/list/create/update/delete.
- Taxonomies: read/write.
- Options: **whitelisted** `get/set`.
- Menus: get/set.
- Users: read/list (write behind approval).

**Media**
- Upload/delete with MIME whitelist and virus scan.

**Files (restricted to `wp-content/**`)**
- `files.read(path)`
- `files.diff(proposed)`
- `files.applyPatch(patchBundle)` → **approval required**

**WP‑CLI**
- `wpcli.run(command, args)` → **read‑safe whitelist** (e.g., `core version`, `plugin list`, `cache flush`, `search-replace --dry-run`).
- `wpcli.runPrivileged(...)` → gated by approval + SSH.

**Diagnostics**
- `logs.tail` for `WP_DEBUG_LOG` / PHP errors.
- `perf.lighthouse(url)` for LCP/CLS insights.
- `hooks.list` (discover actions/filters).
- `theme.scan` (blocking assets, enqueue patterns).

**Git**
- `git.status/branch/commit/push`.
- `git.createBranch(review/*)`, `git.openPR` (provider adapters: GitHub/GitLab/Bitbucket).

---

## 6) Developer Experience (Editor UX)
- **Virtual FS tree** mirroring `wp-content`.
- **Chat‑to‑Change**: prompt → tool plan → diff → approval → apply.
- **Inline Fix**: select code → "Fix with AI" → patch + tests.
- **Context Packs**: auto‑collected context (theme files, enqueue graph, PSI results, Query Monitor dumps).
- **Test Hooks**: Playwright/Lighthouse runs; smoke tests configured per project.
- **Git‑first**: every change is commit‑ready; branch workflows built‑in.

---

## 7) Example Data Flow
1) User: "Improve LCP: lazy‑load hero, adjust critical CSS."
2) Agent plan: `files.read` → analyze → propose patches → `lighthouse` dry run on staging/preview → show diffs.
3) UI: present diffs + migration notes.
4) User approves → apply → cache purge → smoke tests → report metrics.

---

## 8) Technology Stack
- **App:** Next.js 15 (App Router), React, Monaco editor, unified diff viewer; Desktop via **Tauri/Electron** (native SSH/Git/FS). LLM router (cloud + local fallback via Ollama/LM Studio).
- **MCP Tools:** Node/TypeScript services (separately deployable, containerized).
- **WP Plugin:** PHP 8.2+, PSR‑4 autoloading, REST routes, JWT/App Passwords, nonces, capability gating, server‑side patch applier (diff libs + PHPCS fixer).
- **CI/CD:** GitHub Actions (lint, phpstan/psalm, unit/integration tests), release pipelines.

---

## 9) MCP Tool Definition (excerpt)
```json
{
  "name": "wp-connector",
  "description": "Safe WordPress control surface",
  "tools": [
    {
      "name": "posts.create",
      "input_schema": {
        "type": "object",
        "properties": {
          "siteId": {"type": "string"},
          "title": {"type": "string"},
          "content": {"type": "string"},
          "status": {"type": "string", "enum": ["draft", "publish"]}
        },
        "required": ["siteId", "title", "content"]
      },
      "scope": "posts:write"
    },
    {
      "name": "files.applyPatch",
      "input_schema": {
        "type": "object",
        "properties": {
          "siteId": {"type": "string"},
          "patchBundle": {"type": "string"}
        },
        "required": ["siteId", "patchBundle"]
      },
      "scope": "fs:write",
      "approval": true
    }
  ]
}
```

---

## 10) WP Plugin REST Sketch
- `POST /wp-json/wpcursor/v1/auth/token` → scoped token issuance.
- `GET  /wp-json/wpcursor/v1/posts?status=draft`
- `POST /wp-json/wpcursor/v1/files/diff` → returns diagnostics + suggested guards.
- `POST /wp-json/wpcursor/v1/files/apply` → requires `X-Approval-Token` header.
- `POST /wp-json/wpcursor/v1/wpcli/run` → whitelist‑enforced commands.
- `GET  /wp-json/wpcursor/v1/logs/tail?stream=php_error` → SSE stream.

**Server‑side applier** safeguards:
- Restrict to `wp-content/**`.
- Pre‑apply backups; post‑apply cache purge; smoke tests; signed audit record.

---

## 11) Sandbox & Rollout Strategy
- **Local Sandbox Mode (recommended)**
  - `wp-cursor sandbox start` → pull files + sanitized DB → run Docker WP locally → apply & test → open PR back to repo.
- **Direct Mode (fast track)**
  - Allow safe, scoped changes (content, menus, whitelisted options) directly on live after approval + snapshot.
- **Staging Mode**
  - Plugin knows staging URL. Apply → staging; on success → promote to live via Git/Deploy hook.

---

## 12) Governance, Cost & Telemetry
- **Model policy** per site/workspace (allowed models, token limits, PII guards).
- **Token budgets** per action to prevent cost spikes.
- **Telemetry:** tool durations, failure rates, diff sizes, revert ratios → drive continuous safeguards.

---

## 13) 90‑Day Roadmap
**Phase 1 (Days 0–30): Foundations**
- WP Plugin v0.1: Auth, scopes, **read‑only** (posts, files.read, logs). Basic audit log.
- MCP: `wp-connector` (read), `git` (status/branch), `lighthouse` (URL runs).
- App: Chat + Tree + read‑only preview. Plans without writes.

**Phase 2 (Days 31–60): Safe Writes**
- Patch engine + diff viewer + approval flow.
- WP‑CLI (read whitelist), cache flush, media upload.
- Sandbox mode (Docker Compose baseline) + smoke tests.

**Phase 3 (Days 61–90): Pro DX**
- Inline AI fixes; “Explain this error” (ingest Query Monitor/Logs).
- Git PR flow, branch policies, “Review with AI”.
- LCP/CLS Assistant (critical CSS, async/defer heuristics), n8n hooks for long‑running jobs.

---

## 14) Predefined Ops (User Flows)
- **Repair Fatal Error** → `logs.tail` → stacktrace analysis → propose patch → diff → approve → apply → smoke.
- **Create CPT + Templates** → generate `register_post_type` (mu‑plugin) + template files + enqueues → diff → approve.
- **Woo SEO Fix Pack** → dequeue blocking assets, WEBP rules, hero lazy‑load, critical CSS → diff → lighthouse before/after.

---

## 15) Packaging
- **App:** web (hosted) + desktop (Tauri/Electron). Desktop recommended for native SSH/Git.
- **Plugin:** `wp-cursor/wp-cursor.php` (strict types, unit tests).
- **CLI:** `wp-cursor` (Node) for sandbox/sync/secrets.

---

## 16) Why MCP + Plugin is the Winning Combo
MCP gives you a clean, extensible tool layer across ecosystems; the WP plugin provides fine‑grained, on‑site authority and safety. Together you get a Cursor‑grade IDE experience with auditable, reversible, and testable WordPress changes.

---

## 17) Immediate v0.1 Deliverables (Scope & Tasks)
- **Repo skeletons** for: `apps/wp-cursor` (Next.js), `plugins/wp-cursor` (WP plugin), `tools/wp-connector`, `tools/wp-cli`, `tools/git`, `tools/lighthouse`.
- **Auth & scopes** end‑to‑end (issue/verify scoped tokens; per‑tool scope checks).
- **Read‑only flows** wired: list posts, read files, tail logs, run lighthouse.
- **Audit log** (signed append‑only) + initial admin console page in WP.
- **Sandbox CLI**: `wp-cursor sandbox start` (Docker Compose, DB sanitization hook).

> From here, add the patch applier, approval UI, and WP‑CLI write‑whitelist to unlock Phase 2.

---

## Implementation Status (v0.1)
- Plugin skeleton in `plugins/wp-cursor` with REST + MCP:
  - Endpoints: `/health`, `/auth/token`, `/posts`, `/logs/tail`.
  - MCP tools: `posts.list`, `posts.get`, `logs.tail`, `files.read`.
  - Signed append-only audit log (uploads/wpcursor/audit.log).
  - Admin console (Tools → WP Cursor) for scoped token issuance and audit view.
- App (Next.js):
  - MCP client wired; routes for tools list/call, posts list, logs tail, files.read (`/api/mcp/files/read`).
- Tools: repo skeletons under `tools/` for `wp-connector`, `wp-cli`, `git`, `lighthouse` (README placeholders).

