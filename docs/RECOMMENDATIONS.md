# wpAgent – Empfehlungen & Umsetzungsplan

Dieses Dokument sammelt Verbesserungen als prüfbare Checkliste. Wir arbeiten sie iterativ ab.

## 1) Authentifizierung vereinheitlichen
- [x] Entscheidung: Einfache Session (`auth-simple`) als „Single Source of Truth“
- [ ] Alle API‑Routen konsistent auf eine Auth‑Methode umstellen (einige Routen nutzen noch `getSession` direkt)
- [x] Middleware anpassen (keine Redirects auf nicht existente Routen)
- [ ] Tests aktualisieren (Routen‑Tests + e2e)

## 2) Secrets serverseitig speichern (statt Cookies)
- [x] DB‑Schema: Tabelle für User‑Integrationen (AI: provider/model/apiKey, WP: base/jwt/writeMode)
- [x] Verschlüsselung: AES‑GCM über `SESSION_SECRET`/`NEXTAUTH_SECRET` (siehe `lib/crypto.ts`)
- [x] API‑Routen `/api/ai/config` & `/api/mcp/connection/*` auf DB‑Speicherung umstellen
- [x] Migrationen + Zugriffsschicht (Drizzle) vorhanden; [ ] Tests

## 3) Session absichern
- [x] `mcp_session` verschlüsseln (AES‑GCM); Middleware toleriert verschlüsseltes Cookie
- [ ] Einheitliches Session‑Handling in `lib/session.ts` (Duplikate `lib/session.ts` vs. `lib/session-server.ts` konsolidieren)
- [ ] Tests für Manipulation/Integrität

## 4) CSRF/Origin‑Schutz
- [x] Utility: Origin/Referer prüfen (allowlist, env‑gesteuert) (`lib/security.ts`)
- [x] POST‑Routen härten für `/api/ai/config` und `/api/mcp/connection/*`
- [x] Tools‑Bridges härten (z. B. `/api/mcp/tools/*`, Files/Posts bridges)
- [ ] E2E/Route‑Tests für valide/invalid Origins

## 5) AI‑Konfiguration zentralisieren
- [ ] Doppelte Provider‑Erstellung entfernen (aktuell zusätzlich `lib/ai/providers.ts` env‑basiert)
- [ ] Sensible Logs entfernen (z. B. keine JWT‑Präfixe in `lib/mcp/client.ts` loggen)
- [ ] Einheitliche Fehlerbehandlung

## 6) Abhängigkeiten stabilisieren
- [ ] Auf stabile Versionen pinnen (Next/React/ai‑sdk)
- [ ] CI‑Durchlauf grün

## 7) Env‑Validierung & Konfiguration
- [ ] Zod‑Validierung für Environment Variablen
- [ ] `metadataBase` aus Env konfigurieren
- [ ] Log‑Level über Env steuern

## 8) Datenmodell säubern
- [ ] Gast‑ID nicht in `user.email` speichern (separates Feld/Typ)
- [ ] Constraints/Indizes prüfen

## 9) Security‑Härtung/Headers
- [ ] CSP/Sicherheits‑Header (z.B. `next-safe/middleware`)
- [ ] Cookies: SameSite/Secure/HttpOnly konsistent

## 10) Tests erweitern
- [ ] Route‑Tests für AI‑Config/MCP‑Connection/Tool‑Bridges
- [ ] Negativfälle (CSRF, fehlende Rechte, ungültige Inputs)

---

## Phase 1 – Quick Wins (Start)
- [x] Auth für `/api/(chat)/history` und `/api/(chat)/vote` auf `auth-simple` vereinheitlichen
- [ ] Sensible Logs entfernen (API‑Key/JWT‑Präfixe)
- [x] Backup‑Datei `app/(chat)/actions.ts.backup` löschen (nicht vorhanden)
- [x] Origin‑Checks für `/api/ai/config` und `/api/mcp/connection/*`
- [ ] Origin‑Checks für Tools‑Bridges (`/api/mcp/tools/*`)

## Phase 2 – Serverseitige Speicherung
- [ ] Migration + Tabellenmodell für Integrations‑Secrets
- [ ] API‑Routen auf DB statt Cookies migrieren

## Phase 3 – Session/CSRF/Headers
- [ ] Signatur/Verschlüsselung Session
- [ ] CSP/Headers/Middleware‑Update

## Phase 4 – Stabilisierung & Doku
- [ ] Dependencies pinnen, CI grün
- [ ] README/AGENTS um Security/Setup ergänzen
