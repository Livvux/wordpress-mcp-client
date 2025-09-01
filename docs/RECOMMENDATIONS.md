# wpAgentic – Empfehlungen & Umsetzungsplan

Dieses Dokument sammelt Verbesserungen als prüfbare Checkliste. Wir arbeiten sie iterativ ab.

## 1) Authentifizierung vereinheitlichen
- [ ] Entscheidung: Entweder NextAuth oder einfache Session als „Single Source of Truth“
- [ ] Alle API‑Routen konsistent auf eine Auth‑Methode umstellen
- [ ] Middleware anpassen (keine Redirects auf nicht existente Routen)
- [ ] Tests aktualisieren (Routen‑Tests + e2e)

## 2) Secrets serverseitig speichern (statt Cookies)
- [ ] DB‑Schema: Tabelle für User‑Integrationen (AI: provider/model/apiKey, WP: base/jwt/writeMode)
- [ ] Verschlüsselung: AES‑GCM über `SESSION_SECRET`/`NEXTAUTH_SECRET`
- [ ] API‑Routen `/api/ai/config` & `/api/mcp/connection/*` auf DB‑Speicherung umstellen
- [ ] Migrationen + Zugriffsschicht (Drizzle) + Tests

## 3) Session absichern
- [ ] `mcp_session` signieren/verschlüsseln oder serverseitige Session verwenden
- [ ] Einheitliches Session‑Handling in `lib/session.ts`
- [ ] Tests für Manipulation/Integrität

## 4) CSRF/Origin‑Schutz
- [ ] Utility: Origin/Referer prüfen (allowlist, env‑gesteuert)
- [ ] POST‑Routen härten (`/api/ai/config`, `/api/mcp/connection/*`, Tools‑Bridges)
- [ ] E2E/Route‑Tests für valide/invalid Origins

## 5) AI‑Konfiguration zentralisieren
- [ ] Doppelte Provider‑Erstellung entfernen (nur `lib/ai/providers-config.ts` nutzen)
- [ ] Sensible Logs entfernen (nie API‑Key‑Teile loggen)
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
- [ ] Auth für `/api/(chat)/history` und `/api/(chat)/vote` auf `auth-simple` vereinheitlichen
- [ ] Sensible Logs entfernen (API‑Key‑Präfix/Längen)
- [ ] Backup‑Datei `app/(chat)/actions.ts.backup` löschen
- [ ] Einfache Origin‑Checks für POST‑Routen (`/api/ai/config`, `/api/mcp/connection/*`)

## Phase 2 – Serverseitige Speicherung
- [ ] Migration + Tabellenmodell für Integrations‑Secrets
- [ ] API‑Routen auf DB statt Cookies migrieren

## Phase 3 – Session/CSRF/Headers
- [ ] Signatur/Verschlüsselung Session
- [ ] CSP/Headers/Middleware‑Update

## Phase 4 – Stabilisierung & Doku
- [ ] Dependencies pinnen, CI grün
- [ ] README/AGENTS um Security/Setup ergänzen

