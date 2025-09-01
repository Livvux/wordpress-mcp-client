# wpAgentic Ausbauplan: Hybrid MCP + REST für WordPress

Status: Draft v1
Owner: Platform
Last updated: 2025-09-01

## Ziele
- Chat-gesteuerte WordPress-Steuerung mit sicherem, nachvollziehbarem Ausführungspfad.
- Hybrid-Architektur: MCP für semantische Tool-Calls, REST für deterministische Ausführung.
- Datenschutz by default: Gäste lokal/ephemer, angemeldete Nutzer optional serverseitig mit Verschlüsselung.

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

## WordPress-Client (Server)
- Nur serverseitig; Secrets nie zum Client.
- JWT/App Password; Backoff/Retry, Timeout, Telemetrie (redaktiert).
- Idempotenz via `Idempotency-Key` Header/DB-Check.

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
- [ ] Migrations für Felder/Tabellen hinzufügen
- [ ] Auth reaktivieren, Tests reparieren
- [ ] WP-Client implementieren (signing, retry, idempotency)
- [ ] Endpunkte `validate`, `posts`, `media`, `preview`
- [ ] MCP-Tool-Layer auf REST umstellen
- [ ] UI: Write-Flow (Preview/Diff/Commit), Toggles
- [ ] Tests (Route/E2E) und Lint/TS Clean

