# Preview Embed + Worker — Implementation Plan

Goal: Deliver fast preview value with lowest complexity by starting with an iframe-based preview using short‑lived, signed WordPress preview links (via plugin). Introduce an async screenshot/check worker (Browserless/CDP) as a Phase‑2 fallback for sites that block iframes or require artifacts/history. Phase‑3 adds local Playwright, visual regression, and scheduling.

---

## 1) Scope
- Phase 1 (MVP): Embed preview via signed WP plugin link inside an iframe in Chat/Artifact. Lowest effort, high utility for drafts and published content.
- Phase 2: Async worker fallback (Browserless/CDP) for screenshots/checks when iframe is blocked or when artifacts/history are needed.
- Phase 3: Local Playwright runtime, visual regression baselines, and scheduled runs.

Non-goals (for now):
- Running Playwright within Next.js API handlers.
- Visual regression in Phase 1.
- Replacing existing HTML sanitize preview endpoint (`POST /api/wp/preview`).

---

## 2) High-Level Architecture

Phase 1 (Embed):

```
App (Next.js) ── server-side fetch ──► WP Plugin (preview-link)
     │                                     │
     └───────────── iframe src = signed preview URL ───────────────► Browser
           (Preflight XFO/CSP check; fallback: open in new tab)
```

Phase 2 (Worker Fallback):

```
App (Next.js)                        Redis (Queue)                 Worker Microservice (Node + Playwright)
┌────────────────────────────────┐   ┌────────────────────────┐    ┌───────────────────────────────────────┐
│ POST /api/wp/preview/screenshot│ → │   preview:jobs (Bull)  │ →  │ Consume jobs, run Playwright,         │
│  - validates + enqueue Job     │   │  state: queued/running │    │ store artifacts, update status/result │
│ GET  /api/wp/preview/job/:id   │ ← │   preview:results       │ ←  │ returns: screenshotUrl, dom, metrics  │
└────────────────────────────────┘   └────────────────────────┘    └───────────────────────────────────────┘
                      │                                        ┌──────────────────────┐
                      └────────────────────────────────────────►│ Blob/S3 (Artifacts) │
                                                               └──────────────────────┘
```

Driver options:
- `PREVIEW_DRIVER=local` → Playwright in our worker Docker (Chromium).
- `PREVIEW_DRIVER=browserless` → Hosted Browserless Playwright API; worker calls HTTP endpoint.

Storage options:
- `BLOB_*` (preferred) or S3-compatible bucket. Local dev fallback to `artifacts/previews/`.

---

## 3) WordPress Plugin Changes (Phase 1 Required)
- Public pages require no plugin changes.
- Draft/Revision previews require a nonce (`?preview=true&preview_id=...&preview_nonce=...`).
- Provide a dedicated endpoint to resolve a short‑lived, signed preview URL for a specific revision/autosave:
  - `GET /wp-json/wpcursor/v1/preview-link?post_id=:id&type=post&revision_id=:rev?`
  - Response:
    ```json
    {
      "url": "https://example.com/?p=123&preview=true&_ppp=abc123&preview_id=456",
      "ttl": 300,
      "type": "revision",
      "postId": 123,
      "revisionId": 456
    }
    ```
  - Implementation notes:
    - Prefer `get_preview_post_link()` server‑side; if using Public Post Preview, ensure token TTL and scope.
    - If a `revision_id` is not provided, resolve the latest autosave/revision for `post_id`.
    - Set relaxed framing/CSP for a preview route only (not site‑wide): `frame-ancestors https://<app-origin>`; remove `X-Frame-Options: deny/sameorigin` for that route.
    - Use a very short TTL (e.g., 5–10 minutes) and scope tokens strictly to the specific revision.
  - Scope: `posts:read` (scoped token issuance already in plugin plan).

Start with this endpoint to standardize draft previews. Published URLs can bypass it.

---

## 4) API Contracts (App)

### 4.1 GET `/api/wp/preview/link`
- Purpose: Resolve a signed preview URL (server-to-server) for embedding.
- Query: `postId` (required for drafts), optional `revisionId`. Or `url` for published page passthrough.
- Response:
  - `200 OK`: `{ url, ttl }` (never expose WP tokens beyond what is needed for iframe `src`).
  - `400/403`: validation/origin errors.

Notes:
- Prefer fetching link server-side and rendering directly in an iframe component; this endpoint can be skipped if the app calls WP directly from the server.

### 4.2 POST `/api/wp/preview/screenshot` (Phase 2)
- Purpose: Enqueue a preview job.
- Headers: `Idempotency-Key` (optional)
- Body (JSON):
  - `siteUrl` (string, required): must match a verified WordPress connection (SSRF guard).
  - one of:
    - `url` (string): absolute URL to render (preferred if published).
    - `postId` (string|number) + optional `revisionId` (string|number): resolve signed preview via WP Plugin.
  - `viewport` (object, optional): `{ width: number, height: number }` (default 1280x800)
  - `fullPage` (boolean, default false)
  - `waitUntil` ("load" | "domcontentloaded" | "networkidle", default "networkidle")
  - `userAgent` (string, optional)
  - `extraHeaders` (record, optional; sanitized allowlist)
  - `checks` (array, optional): `["title","h1","canonical","noConsoleErrors"]`
- Response:
  - `202 Accepted`: `{ jobId, statusUrl: "/api/wp/preview/job/<id>" }`
  - `400/403/429`: validation, origin, or rate-limit errors.

### 4.3 GET `/api/wp/preview/job/:id` (Phase 2)
- Purpose: Poll job status/result.
- Response (200):
  - `{ id, state: "queued"|"running"|"succeeded"|"failed"|"expired", createdAt, updatedAt,
      input: { ...sanitized },
      result?: {
        screenshotUrl?: string,
        pdfUrl?: string,
        dom?: { title?: string, h1?: string, meta?: Record<string,string>, consoleErrors?: string[] },
        metrics?: { ttfbMs?: number, loadTimeMs?: number },
        checks?: Array<{ name: string, ok: boolean, details?: string }>
      },
      error?: { message: string, code?: string }
    }`
- `404` if not found; `410` if evicted.

Removed for MVP: separate `/checks` endpoint (can be a request flag later).

---

## 5) Job Schema (Queue) — Phase 2
```ts
type PreviewJobInput = {
  siteUrl: string;
  url?: string;
  postId?: string | number;
  revisionId?: string | number;
  resolvedUrl?: string; // populated by worker prior to navigate
  viewport?: { width: number; height: number };
  fullPage?: boolean;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  userAgent?: string;
  extraHeaders?: Record<string, string>;
  checks?: string[];
  idemKey?: string; // from Idempotency-Key header
  requestedBy: { userId: string; connectionId?: string };
};

type PreviewJobResult = {
  screenshotUrl?: string;
  pdfUrl?: string;
  dom?: {
    title?: string;
    h1?: string;
    meta?: Record<string, string>;
    consoleErrors?: string[];
  };
  metrics?: { ttfbMs?: number; loadTimeMs?: number };
  checks?: Array<{ name: string; ok: boolean; details?: string }>;
};
```

States: `queued` → `running` → `succeeded|failed`. TTL for records: 24–72h (configurable).

---

## 6) Security & Compliance
- AuthZ: Only authenticated users; enforce per-site RBAC (existing RBAC helpers).
- Origin: reuse `isAllowedOrigin`.
- Phase 1 (Embed):
  - Plugin must set `Content-Security-Policy: frame-ancestors https://<app-origin>` only for the preview route; remove conflicting `X-Frame-Options`.
  - App performs a preflight HEAD/GET to detect `x-frame-options`/`content-security-policy` blocks and shows a clear "Open in new tab" fallback.
- SSRF (Phase 2): Only allow `siteUrl` that is verified for the user; resolve DNS and block private IP ranges (RFC1918, link-local, loopback). Deny redirects crossing to private IPs; forbid `http`, `file:`, `data:`.
- Rate limiting: per user/site window (e.g., 10/min) using `lib/http/rate-limit.ts`.
- Idempotency (Phase 2 optional): add `Idempotency-Key` support later; MVP can dedupe by hash `(userId, url, viewport)`.
- Timeouts & budgets (Phase 2): render < 20s; block downloads; HTTPS only; redact headers in persisted job input.
- WAF/CDN interop: allowlist Browserless egress IPs or your worker’s egress; exempt preview path from bot/JS challenges when feasible.
- Secrets: never expose WP tokens to client beyond what’s necessary for iframe `src`; no JWTs in logs.

---

## 7) Worker Microservice (Node + TS) — Phase 2

Proposed directory (to be created in implementation phase):
```
services/preview-worker/
  package.json
  tsconfig.json
  src/
    index.ts            // bootstrap: queue connect, consumers, healthz
    queue.ts            // BullMQ connection helpers
    worker.ts           // define processor for 'preview:jobs'
    drivers/
      local.ts          // Playwright-based renderer
      browserless.ts    // Hosted API-based renderer
    storage.ts          // blob/S3/local storage utils
    security.ts         // SSRF/ip guard, URL validation
    checks.ts           // DOM checks
  Dockerfile
  README.md
```

Worker flow:
1. Resolve target URL: if `postId` and plugin endpoint configured, fetch signed preview URL; else use `url`.
2. Validate URL host matches `siteUrl` and passes SSRF checks.
3. Render (driver):
   - Local: Playwright Chromium → `page.goto(resolvedUrl, { waitUntil })` → collect console errors → screenshot/pdf.
   - Browserless: POST `/playwright` with a script that navigates and returns base64 artifacts + DOM.
4. Run `checks` over DOM/signals (title/H1/canonical/no console errors, etc.).
5. Store artifacts using `BLOB_*` or S3; local dev → `artifacts/previews/{jobId}/...`.
6. Update job result and emit completion.

Health/live:
- `/healthz` (HTTP) for readiness/liveness in container; also expose BullMQ metrics later.

---

## 8) Dockerfile (Worker) — Phase 2

Two variants:

### 8.1 Local Playwright
- Base: `mcr.microsoft.com/playwright:v1.50.1-jammy` (or official `playwright` image matching dev dependency).
- Steps:
  - Install pnpm deps.
  - Build TS.
  - `CMD ["node", "dist/src/index.js"]`.

### 8.2 Browserless (No Playwright runtime in container)
- Base: `node:20-alpine` (lightweight).
- Installs only app deps (no browsers).
- Driver uses `BROWSERLESS_URL` + `BROWSERLESS_API_KEY` to perform rendering.

Both variants mount a temp dir for scratch space and run as non-root.

---

## 9) Configuration (env)

App:
- `REDIS_URL` — required for queue (Phase 2).
- `BLOB_*` or `S3_*` — storage for artifacts (Phase 2).
- `PREVIEW_JOB_TTL_SECONDS` — default 86400 (Phase 2).
- `PREVIEW_RATE_LIMIT` — e.g., `10/m` per user/site (Phase 2).
- `APP_ORIGIN` or `NEXT_PUBLIC_APP_ORIGIN` — used by the WP plugin for `frame-ancestors`.
- `WP_PREVIEW_ENDPOINT` — plugin REST endpoint for preview-link resolution.

Worker:
- `REDIS_URL` — queue backend.
- `PREVIEW_DRIVER` — `local` | `browserless`.
- `BROWSERLESS_URL`, `BROWSERLESS_API_KEY` — if driver=browserless.
- `ARTIFACT_BASE_URL` — public base for stored artifacts.
- `ARTIFACT_BUCKET`/`BLOB_READ_WRITE_TOKEN` — storage credentials.
- `WP_PREVIEW_ENDPOINT` — plugin endpoint to resolve draft preview links.

---

## 10) Implementation Steps (Phased)

Phase 1 — Embed (fastest value)
1. Implement WP Plugin `wpcursor/v1/preview-link` with short‑lived, signed URLs; set `frame-ancestors https://<app-origin>` only for preview route; remove `X-Frame-Options` there.
2. App: Add `PreviewEmbed` component with preflight (check XFO/CSP). If blocked, show "Open in new tab" fallback.
3. Trigger: After `POST/PATCH` of posts resolve preview link server‑side and render in Chat/Artifact.
4. AuthZ/Origin guard: only for verified `siteUrl` connections; never expose raw tokens besides iframe src.

Phase 2 — Worker (Browserless Fallback)
5. Add API routes:
   - `POST /api/wp/preview/screenshot` → validate, rate-limit, enqueue (BullMQ).
   - `GET /api/wp/preview/job/:id` → poll status/result.
6. Implement worker with `browserless` driver (no local Chromium). Resolve preview link via plugin for drafts.
7. Store artifacts to Blob/S3; basic checks (`title`, `h1`, `canonical`, `noConsoleErrors`); minimal metrics (`loadTimeMs`).
8. UI: Fallback tab to screenshot + optional history; poll every 3–5s with backoff.

Phase 3 — Local Playwright + Visuals
9. Add `local` driver (Chromium) + Dockerfile; stronger SSRF guards.
10. Visual regression (baselines) per route/post; scheduling over sitemap.
11. Observability & dashboards (Prometheus exporter), idempotency header, advanced metrics.

---

## 11) UI Integration (Chat & Artifact)

User experience in the App to surface previews:
- Phase 1 (Embed):
  - PreviewPane/PreviewCard renders iframe with signed preview link.
  - Preflight: detect XFO/CSP block; if blocked, show clear fallback: "Open in new tab".
  - Auto-refresh if link TTL expired (re-fetch preview link server-side).
- Phase 2 (Worker Fallback):
  - Screenshot tab with latest artifact; optional viewport selector.
  - Checks tab with basic outcomes; poll via `/job/:id`.
- Triggers:
  - Automatic after `POST/PATCH` draft updates: resolve preview link and render immediately. On iframe block or when artifacts requested → enqueue screenshot job.
  - Manual "Generate Screenshot" button.
- State management: `usePreviewJob` hook (poll every 3–5s, backoff, stop on terminal states), SSR‑safe.
- Errors: Show WAF/Challenge/404/500 clearly; suggest allowlisting or opening in new tab.

---

## 12) Testing Strategy
- Embed tests (Phase 1): preflight header detection, TTL refresh logic, link resolution permissions.
- Route tests (Phase 2): enqueue, poll, error handling, rate-limit, minimal idempotency.
- Worker tests (Phase 2): URL resolution, SSRF guard, driver abstraction, storage stub.
- E2E (opt-in): against a staging URL covering both embed and screenshot fallback.

---

## 13) Example Payloads (Phase 2)

POST `/api/wp/preview/screenshot`
```json
{
  "siteUrl": "https://example.com",
  "url": "https://example.com/sample-page",
  "viewport": { "width": 1280, "height": 800 },
  "fullPage": true,
  "checks": ["title","h1","canonical","noConsoleErrors"]
}
```

202 Accepted
```json
{ "jobId": "prv_01JABC...", "statusUrl": "/api/wp/preview/job/prv_01JABC..." }
```

GET `/api/wp/preview/job/prv_01JABC...`
```json
{
  "id": "prv_01JABC...",
  "state": "succeeded",
  "createdAt": 1735900000,
  "updatedAt": 1735900017,
  "result": {
    "screenshotUrl": "https://blob.example.com/previews/prv_01JABC.../1280x800.png",
    "dom": { "title": "Sample Page", "h1": "Sample Page", "meta": {"canonical":"https://example.com/sample-page"}, "consoleErrors": [] },
    "metrics": { "loadTimeMs": 1540 }
  }
}
```

---

## 14) Open Questions / Decisions
- Draft preview resolution: adopt plugin endpoint vs. cookie-based access?
- Storage choice: Vercel Blob vs. S3; signed URLs duration.
- Result retention: How long to keep artifacts; user deletion path.
- Browserless cost/limits vs. self-hosted worker scale.

---

## 15) Quick Wins Checklist
- [ ] WP Plugin: `wpcursor/v1/preview-link` with short TTL and `frame-ancestors` for preview route
- [ ] App: `PreviewEmbed` with preflight and open-in-new-tab fallback
- [ ] Server-side link resolution after create/update of drafts
- [ ] Phase 2 scaffolding: API stubs (`/screenshot`, `/job/:id`) behind feature flag
- [ ] Introduce BullMQ + Redis wiring (Phase 2)
- [ ] Implement Browserless driver MVP (Phase 2)
- [ ] Wire Blob/S3 storage (Phase 2)
- [ ] Add route tests and worker unit tests (Phase 2)
- CDP usage (Browserless, Chrome‑based) — recommended for stability/perf:
  ```ts
  import { chromium } from 'playwright-core';

  export async function renderPreview(previewUrl: string) {
    const ws = `wss://production-ams.browserless.io?token=${process.env.BROWSERLESS_TOKEN}`;
    const browser = await chromium.connectOverCDP(ws);
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    page.on('console', msg => { if (msg.type() === 'error') /* collect */ null; });
    await page.goto(previewUrl, { waitUntil: 'networkidle', timeout: 20000 });
    const png = await page.screenshot({ fullPage: true });
    await ctx.close();
    await browser.close();
    return png;
  }
  ```
- [ ] Optional (later): local Playwright driver + visual regression

