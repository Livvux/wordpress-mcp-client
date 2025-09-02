export default function AdminHomePage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Übersicht</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Verwalte globale Einstellungen, Integrationen und Datenbankstatus.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <a
          href="/admin/ai-config"
          className="group rounded-xl border border-zinc-200 bg-white p-5 hover:shadow-md transition-all dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="mb-3 h-9 w-9 rounded-md bg-black text-white dark:bg-zinc-800 dark:text-zinc-100 flex items-center justify-center text-xs">
            AI
          </div>
          <div className="text-sm font-medium">Global AI configuration</div>
          <div className="text-xs text-zinc-600 dark:text-zinc-400">
            Provider & Model für systemweites Admin‑Modell festlegen.
          </div>
        </a>
        <a
          href="/admin/wp-plugin"
          className="group rounded-xl border border-zinc-200 bg-white p-5 hover:shadow-md transition-all dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="mb-3 h-9 w-9 rounded-md bg-black text-white dark:bg-zinc-800 dark:text-zinc-100 flex items-center justify-center text-xs">
            WP
          </div>
          <div className="text-sm font-medium">WordPress Plugin Onboarding</div>
          <div className="text-xs text-zinc-600 dark:text-zinc-400">
            Verbindung herstellen und Tools verwalten.
          </div>
        </a>
        <form
          action={async () => {
            'use server';
            const res = await fetch(
              `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/admin/db/migrate`,
              { method: 'POST' },
            );
            if (!res.ok) throw new Error('Migration failed');
          }}
          className="group rounded-xl border border-zinc-200 bg-white p-5 hover:shadow-md transition-all dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="mb-3 h-9 w-9 rounded-md bg-black text-white dark:bg-zinc-800 dark:text-zinc-100 flex items-center justify-center text-xs">
            DB
          </div>
          <div className="text-sm font-medium mb-1">
            Datenbank-Migration anwenden
          </div>
          <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-3">
            Führt ausstehende Drizzle‑Migrationen aus.
          </div>
          <button
            type="submit"
            className="text-xs rounded bg-black text-white dark:bg-zinc-200 dark:text-zinc-900 px-3 py-1 hover:opacity-90"
          >
            Migration ausführen
          </button>
        </form>
      </div>
    </div>
  );
}
