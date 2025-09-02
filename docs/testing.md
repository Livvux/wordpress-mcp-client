# Funktions- und E2E-Tests mit Playwright

Diese Anleitung beschreibt, wie du die App lokal funktional testest (UI + API) – inklusive Setup, Datenbank, Umgebungsvariablen und typische Fehlerbilder.

## Voraussetzungen
- Node.js 18+ und `pnpm`
- Playwright-Browser: `pnpm exec playwright install --with-deps`
- Entweder lokale Postgres per Docker (empfohlen für E2E) oder eine eigene Remote‑DB

## Umgebungsvariablen
- Kopiere `.env.example` nach `.env.local` und passe an.
- Für lokale Tests mit Docker‑Postgres:
  - `APP_MODE=premium`
  - `DB_ENABLED=true`
  - `POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/wpagentic`
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/wpagentic`
- Externe AI‑Keys sind für Tests nicht nötig. In Playwright‑Runs werden LLM‑Antworten gemockt und deterministisch erzeugt.

Optional für bessere Trennung von Dev/Tests:
- Lege `.env.test.local` an (z. B. eigene Test‑DB). Wenn du das möchtest, kann die Playwright‑Config angepasst werden, um diese Datei statt `.env.local` zu laden.

## Datenbank starten
- Docker (empfohlen):
  - `docker compose up -d`
  - `pnpm db:migrate`
- Remote‑DB (Alternative):
  - Setze `POSTGRES_URL`/`DATABASE_URL` auf eure DB‑Engine (mit SSL‑Parametern, falls nötig), dann `pnpm db:migrate` gegen die Ziel‑DB.
  - Achtung: Für Tests eine eigene Datenbank nutzen (nicht Produktion).

## App lokal starten (nur zur manuellen Verifikation)
- `pnpm dev`
- Healthcheck ist `GET /ping` (wird von Playwright genutzt, um den Serverstart zu erkennen).

## Tests ausführen
- Alle Tests (UI + Routen): `pnpm test`
- Einzelne Datei: `pnpm exec playwright test tests/e2e/chat.test.ts`
- Nur Routen‑Tests: `pnpm exec playwright test tests/routes`
- Nur E2E‑Tests: `pnpm exec playwright test tests/e2e`

Berichte:
- HTML‑Report öffnen: `pnpm exec playwright show-report`

## Debugging & langsamere Durchläufe
- Headful + Step‑Durchlauf: `PWDEBUG=1 pnpm exec playwright test tests/e2e/chat.test.ts`
- Low‑level API‑Logs: `DEBUG=pw:api pnpm exec playwright test`

## Was wird „echt“ getestet?
- „Echte“ App: Playwright startet `pnpm dev` und testet die echte Next.js‑App.
- „Echte“ DB: Tests persistieren in Postgres (Docker oder Remote gemäß `POSTGRES_URL`).
- Auth: Gast‑Session und Register/Login via UI/API werden real durchlaufen.
- LLM/AI: Gemockt in Test‑Umgebung (keine externen API‑Calls; deterministische Antworten für stabile Assertions).

## Häufige Fehlerbilder & Lösungen
- Tests hängen beim Start / Endlosschleife auf `/api/auth/guest`:
  - Behoben: Middleware liest jetzt die Session aus Request‑Cookies. Stelle sicher, dass deine lokale Branch diesen Fix enthält.
  - Leere/alte Cookies im Browser‑Profil von Playwright stören: Lösche `playwright/.sessions` falls vorhanden und starte neu.
- Port 3000 bereits belegt:
  - Beende alte Dev‑Server (`lsof -i :3000`) oder setze `PORT=xxxx pnpm test`.
- DB‑Fehler (Verbindung/Migration):
  - Docker‑Container läuft? `docker compose ps`
  - `POSTGRES_URL` korrekt? `pnpm db:migrate` ausführen.
- Sehr langsame Tests bei Remote‑DB:
  - Für E2E lokale Docker‑DB verwenden oder separate, nahegelegene Test‑DB.

## Nützliche Kommandos
- Abhängigkeiten installieren: `pnpm i`
- Playwright Browser installieren: `pnpm exec playwright install --with-deps`
- DB‑Migrations: `pnpm db:migrate`
- Lint/Format vor PR: `pnpm format && pnpm lint && pnpm test`

## Hinweise zu Konfiguration
- Playwright lädt `.env.local` (siehe `playwright.config.ts`). Auf Wunsch kann auf `.env.test.local` umgestellt werden, um Test‑spezifische DSNs zu nutzen.
- KI‑Provider in Tests: Die App verwendet automatisch den Mock‑Provider, es sind keine AI‑Keys nötig.
- WordPress/FIRECRAWL: Optional; nicht erforderlich für Kern‑E2E‑Tests. Falls verbunden, beachten, dass echte Aufrufe erfolgen.

## Support
Wenn du möchtest, kann ich die Playwright‑Config so erweitern, dass `.env.test.local` automatisch für Testläufe geladen wird und eine Beispiel‑Datei hinzufügen. Sag kurz Bescheid.

