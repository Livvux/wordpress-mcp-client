# wpAgent Ausbauplan: Hybrid MCP + REST für WordPress

Status: Draft v1 (maintained)
Owner: Platform
Last updated: 2025-09-01

## Ziele
- Chat-gesteuerte WordPress-Steuerung mit sicherem, nachvollziehbarem Ausführungspfad.
- Hybrid-Architektur: MCP für semantische Tool-Calls, REST für deterministische Ausführung.
- Datenschutz by default: Gäste lokal/ephemer, angemeldete Nutzer optional serverseitig mit Verschlüsselung.

## Umsetzungsstand (v0.1)
- App-REST: `POST /api/wp/validate`, `POST /api/wp/posts`, `PATCH /api/wp/posts/:id`, `POST /api/wp/preview` implementiert; `POST /api/wp/media` implementiert (multipart, Limit, Origin-Check).
- WP-Client: serverseitig mit JWT, Idempotency-Headern und Timeouts vorhanden (`lib/wp/client.ts`).
- DB: Tabellen/Spalten für `AIIntegration`, `WordPressConnection` (+Lifecycle-Felder), `WPActionLog`, `Task` vorhanden (Drizzle + Migrationen).
- MCP-Bridges: `/api/mcp/tools/list`, `/api/mcp/tools/call`, `/api/mcp/posts/list`, `/api/mcp/files/read` vorhanden (Plugin-MCP wird direkt angesprochen). Verbindungstest via `/api/mcp/connection/validate`. Logs Tail Proxy unter `/api/mcp/logs/tail` ergänzt.
- Origin/CSRF: Basis-Utility `lib/security.ts` vorhanden; für sensible POST-Routen (AI-Config, MCP-Connection) angewendet.
- Plugin: `plugins/wp-cursor` mit `/wpcursor/v1/*` + MCP-Endpoint (`/wp/v2/wpmcp/streamable`), Admin-Seite inkl. Token-Issuance und Audit-Log (append-only) vorhanden.
- UI: Admin-Onboarding unter `/admin/wp-plugin`, Onboarding-Wizard, Write-Mode-Toggle; Vorschau über `/api/wp/preview`.

Offen in v0.1:
- E2E/Route-Tests für neue Routen.
- Klärung der Priorisierung: Direkter MCP→Plugin-Call vs. MCP-Wrapper über interne REST (siehe Abschnitt „Klarstellungen“).

## Architekturüberblick
- Chat (Frontend) → MCP Tools (LLM-Funktionsaufrufe) → interne REST-API → WP-Client → WordPress.
- Serverseitige Speicherung nur für angemeldete Nutzer (Opt-in). Gäste bleiben lokal.
- ActionLog und Tasks für Auditing und Langläufer (Medien/Bulk).

## Speicher-Policy (Was/wie speichern)
- Serverseitig (verschlüsselt, pro User):
  - `WordPressConnection`: `siteUrl`, `jwtEncrypted`, `writeMode`, `createdAt`, `updatedAt`, `lastUsedAt`, `lastValidatedAt`, optional `expiresAt`, `status`, optional `fingerprint` (HMAC).
  - `AIIntegration`: `provider`, `model`, `apiKeyEncrypted`, `createdAt`, `updatedAt`, optional `lastUsedAt`.
  - `WPActionLog`: jede Schreib-/Leseaktion (redaktiert), Resultat/HTTP-Code, Korrelation (`idempotencyKey`).
  - `Tasks`: Hintergrundjobs (Upload, Batch-Updates) mit Status/Retry.
- Nur lokal (Browser):
  - Gast-Sessions, UI-Preferences. Keine Secrets.
- Nicht speichern:
  - Klartext-Tokens/Passwörter, sensible Inhalte ohne Zustimmung, Logs mit Secrets.

## Datenbankänderungen (Drizzle)
- Erweiterungen bestehender Tabellen:
  - `WordPressConnection`: Felder `lastUsedAt`, `lastValidatedAt`, `expiresAt`, `status` (enum: `active|invalid|revoked`), optional `fingerprint` (HMAC-Tokenhash).
  - `AIIntegration`: Feld `lastUsedAt`.
- Neue Tabellen:
  - `WPActionLog(id, userId, siteUrl, action, requestMeta, responseMeta, status, createdAt)`
  - `Task(id, userId, kind, params, status, attempts, lastError, createdAt, updatedAt, runAt)`

## Interne REST-API (erste Iteration)
- `POST /api/wp/validate` — Verbindung prüfen/erneuern; schreibt `lastValidatedAt`, `status`.
- `POST /api/wp/posts` — Draft/Publish erstellen (`title`, `content`, `categories`, `tags`, `status=draft|publish`, `idempotencyKey`).
- `PATCH /api/wp/posts/:id` — Partial-Update (idempotent per Key).
- `POST /api/wp/media` — Medien-Upload (multipart, Streams, Größe limitiert).
- `POST /api/wp/preview` — serverseitige Vorschau/Validierung (Links, Bilder, Schema.org).

## MCP-Tools (Mapping auf REST)
- `wp.validate` → `POST /api/wp/validate`
- `wp.create_post`, `wp.update_post`, `wp.upload_media` → rufen ausschließlich unsere REST-Endpunkte.
- Vorteile: einheitliche Policy, Rate-Limits, Auditing, Idempotenz.

Hinweis (Ist-Zustand): Zusätzlich zu diesen REST-Mappings existiert eine direkte MCP-Bridge zur Plugin-API (`/api/mcp/tools/*`). Kurzfristig sinnvoll für schnelle Iteration; mittelfristig sollten schreibende Tools bevorzugt über interne REST laufen, um Auditing/Idempotenz/Rate-Limits zentral durchzusetzen.

## WordPress-Client (Server)
- Nur serverseitig; Secrets nie zum Client.
- JWT/App Password; Backoff/Retry, Timeout, Telemetrie (redaktiert).
- Idempotenz via `Idempotency-Key` Header/DB-Check.

## Auth & Tokens (Sicherheit)
- Pro Site: Access‑Token mit kurzer TTL (~15 min) + rotierender Refresh‑Token (One‑Time‑Use, Replay‑Schutz).
- Tokens an Site‑Origin und Client‑ID binden; Refresh‑Tokens im Plugin nur gehasht speichern. Access‑Token enthalten `aud`.
- Device/One‑Time‑Code Onboarding (Plan): Kein Copy/Paste; App erhält Code, Admin bestätigt im WP‑Plugin.
- Browser sieht nie Secrets: MCP/REST nur serverseitig aufrufen; Cookies `httpOnly`.

## Idempotenz & Retries
- Für alle mutierenden REST‑Routen: `Idempotency-Key` (UUID), 24 h Deduplikation über (Route+Body‑Hash). Response setzt `X-Idempotent-Replay: true` bei Replays.
- Implementiert in: `POST /api/wp/posts`, `PATCH /api/wp/posts/:id`, `POST /api/wp/media`.

## SSE‑Härtung
- Heartbeat alle 15 s (`event: ping`), `Cache-Control: no-store`, `Connection: keep-alive`, `X-Accel-Buffering: no`.
- `Last-Event-ID` wird durchgereicht (Resume‑Vorbereitung). Proxy‑SSE unter `/api/mcp/logs/tail`.

## Fehler-/Policy‑Modell
- Einheitliche Fehlerstruktur (Code/Message) in REST (Mapping für MCP vorgesehen): `UNAUTHORIZED`, `FORBIDDEN_POLICY`, `IDEMPOTENCY_COLLISION`, `RATE_LIMITED`, `TOOL_FAILED`.
- Zentrale Policy‑Engine (Plan): Rollen/Scopes definieren erlaubte Tools & Writes; Write‑Mode/Approvals enforced.

## Write‑Mode & Approvals
- Default „Read‑Only“. Für schreibende REST‑Routen simples Write‑Mode‑Gating (Cookie/Account). Approval/Diff‑UI (Plan) + optional 4‑Augen.
- Kill‑Switch pro Site (Plan): Admin kann Writes temporär sperren.

## Background‑Jobs
- Schwere Tasks (Medien/Massen) über Jobs/Queues (Plan). SSE streamt `job_id`‑Logs + finales MCP‑Result.

## Rate‑Limits & Quoten
- Pro Site/Token/Route: Sliding‑Window + Burst (Redis wenn verfügbar; sonst Fallback). Harte Caps für teure Tools (z. B. media.upload aktuell 5/min).

## Observability
- End‑to‑End Correlation‑ID (`X-Req-Id`).
- Audit‑Felder (Plan/Plugin): time, user_id, site_id, route/tool, idempotency_key, input_hash, status, latency, ip, wp_version, plugin_version.

## CORS/CSRF
- REST nur server‑to‑server. Falls Browser‑POST nötig: `SameSite=strict` + Double‑Submit CSRF + Origin‑Check. `Vary: Origin` gesetzt.

## Security‑Header
- CSP, Permissions‑Policy, Referrer‑Policy, HSTS, X‑Content‑Type‑Options (Plan via Middleware/Edge‑Headers).

## Chat UX-Flow (sicheres Schreiben)
1) Entwurf: Chat generiert Outline/Content, nutzt nur Read-Tools; zeigt Vorschau.
2) Review: Nutzer bestätigt; `dry-run` Diff/Validierung über `POST /api/wp/preview`.
3) Commit: Nutzer bestätigt Publish; REST führt aus, `WPActionLog` schreibt mit Permalink.
- Write-Mode Toggle (opt-in) und Default `status=draft`.

## Sicherheit
- Feldverschlüsselung: AES-GCM, per-Record IV; KEK aus Server-Secret + per-User-Salt; versioniert für Rotation.
- Redaction: Logs, Fehler, Telemetrie ohne Secrets; HMAC-Fingerprints statt Klartext.
- Rate-Limits pro User/Site; RBAC-ready.
- Sofortiges Revoke löscht Secrets + markiert `status=revoked`.

## Background & Webhooks
- Redis-Queue für Upload/Bulk; Retry, Dead-letter.
- Optional WP-Plugin/Webhooks für Status-Callbacks; sonst Polling.

## Tests
- Route-Tests: Mock WP-API, Idempotenz/Audit prüfen, Fehlerpfade (401/403/429/5xx).
- E2E: Entwurf → Review → Commit → Sichtbarkeit/Permalink.
- Security-Tests: keine Secrets in Logs, Verschlüsselung round-trip.
- Additional: Token-Rotation/Replay-Block, SSE-Resume, Rate-Limit-Pfad, Policy-DENY, Approval-Flow, Media-Upload-Limits, Negative CSRF.

## Rolloutplan
1) Auth reaktivieren (E-Mail/Passwort), Gäste beibehalten; Migrations hinzufügen.
2) REST-Skelette (validate, posts, media, preview) + WP-Client.
3) MCP-Tools auf REST mappen; Feature-Flags (Write-Mode, Draft Default).
4) UI: Preview/Diff/Commit, Revoke/Disconnect, Connection-Status.
5) Tests grün (Route/E2E). Observability.

## Offene Fragen
- App Password vs. JWT vs. OAuth für WP? (Start: JWT/App PW)
- Multisite-Unterstützung/Priorisierung?
- Mediengrößenlimits/CDN-Strategie?

## Nächste Schritte (Umsetzung)
- [x] Migrations für Felder/Tabellen hinzufügen
- [x] Auth reaktivieren
- [ ] Tests reparieren (neue Routen abdecken)
- [x] WP-Client implementieren (JWT, retry/idempotency)
- [x] Endpunkte `validate`, `posts`, `preview`
- [x] Endpoint `media` (Upload, Limits)
- [ ] MCP-Tool-Layer konsequent auf REST umstellen (schreibende Pfade)
- [x] UI: Toggles/Validierung/Vorschau
- [ ] UI: Diff/Commit-Fluss (Freigabe/Approval)
- [ ] Tests (Route/E2E) und Lint/TS Clean

## Klarstellungen & Überschneidungen
- Doppelte Pfade zu WordPress: Aktuell existieren sowohl (a) direkte MCP-Aufrufe zum Plugin als auch (b) interne REST-Endpunkte. Empfehlung: Lese-Tools können weiterhin direkt über MCP laufen; schreibende Tools sollen über interne REST gehen (Idempotenz, Auditing, Rate-Limits, zentrale Policy). Übergangsphase erlaubt beide.
- AI-Provider-Konfiguration: Serverseitige Speicherung ist vorhanden; die Laufzeit-Nutzung ist in Teilen noch env-basiert. Zielbild: einheitlich aus DB/Server-Policy speisen und keine sensiblen Logs (keine Schlüssel-Präfixe). 
