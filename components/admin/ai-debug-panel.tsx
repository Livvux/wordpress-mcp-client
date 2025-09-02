'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AI_PROVIDERS } from '@/lib/ai/providers-config';

type ProviderDiag = {
  id: string;
  name: string;
  apiKeyPresent: boolean;
  apiKeyLooksValid: boolean;
  apiKeySource: string | null;
  apiKeyLast4: string | null;
  reachable: boolean | null;
  error: string | null;
  modelsCount: number | null;
};

type DiagResponse = {
  success: boolean;
  adminConfig: {
    provider: string;
    chatModel: string | null;
    reasoningModel?: string | null;
  } | null;
  providers: ProviderDiag[];
};

function StatusIcon({
  ok,
  pending = false,
}: { ok: boolean | null; pending?: boolean }) {
  if (pending || ok === null) {
    return (
      <span
        className="inline-block h-2.5 w-2.5 rounded-full bg-yellow-400"
        title="Ungeprüft"
      />
    );
  }
  return ok ? (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full bg-green-500"
      title="OK"
    />
  ) : (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full bg-red-500"
      title="Fehler"
    />
  );
}

export default function AIDebugPanel() {
  const [data, setData] = useState<DiagResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/ai-config/diagnostics', {
        cache: 'no-store',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `HTTP ${res.status}`);
      }
      const j = (await res.json()) as DiagResponse;
      setData(j);
    } catch (e: any) {
      setError(e?.message || 'Diagnose fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const providersById = useMemo(() => {
    const m = new Map(AI_PROVIDERS.map((p) => [p.id, p]));
    return m;
  }, []);

  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Debug & Diagnose</h2>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1 rounded border border-zinc-200 bg-white hover:bg-gray-50 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
            onClick={load}
            disabled={loading}
          >
            {loading ? 'Prüfe…' : 'Erneut prüfen'}
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-600 dark:text-zinc-400">
        Übersicht, ob Provider konfiguriert sind (API‑Key) und ob die Verbindung
        erfolgreich getestet werden konnte. Es werden keine Schlüssel
        offengelegt – nur die letzten 4 Zeichen.
      </p>

      {error && (
        <div className="text-sm text-red-600 dark:text-red-500">{error}</div>
      )}

      {data?.adminConfig && (
        <div className="rounded border border-zinc-200 p-3 bg-gray-50 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-sm font-medium mb-1">
            Globale Admin‑Konfiguration
          </div>
          <div className="text-sm text-gray-700 dark:text-zinc-300">
            Provider:{' '}
            <span className="font-mono">{data.adminConfig.provider}</span>
            {data.adminConfig.chatModel ? (
              <>
                {' '}
                · Chat‑Modell:{' '}
                <span className="font-mono">{data.adminConfig.chatModel}</span>
              </>
            ) : null}
            {data.adminConfig.reasoningModel ? (
              <>
                {' '}
                · Reasoning‑Modell:{' '}
                <span className="font-mono">
                  {data.adminConfig.reasoningModel}
                </span>
              </>
            ) : null}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-zinc-900">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Provider</th>
              <th className="text-left px-3 py-2 font-medium">Konfiguriert</th>
              <th className="text-left px-3 py-2 font-medium">Erreichbar</th>
              <th className="text-left px-3 py-2 font-medium">Modelle</th>
              <th className="text-left px-3 py-2 font-medium">Hinweis</th>
            </tr>
          </thead>
          <tbody>
            {(
              data?.providers ||
              (AI_PROVIDERS.map((p) => ({ id: p.id, name: p.name })) as any)
            ).map((p: any) => {
              const meta = providersById.get(p.id);
              return (
                <tr
                  key={p.id}
                  className="border-t border-zinc-200 dark:border-zinc-800"
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {meta?.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={meta.logoUrl} alt="" className="h-5 w-5" />
                      ) : null}
                      <div className="font-medium">{meta?.name || p.name}</div>
                      <div className="text-gray-500 dark:text-zinc-400">
                        (<span className="font-mono">{p.id}</span>)
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <StatusIcon
                        ok={p.apiKeyPresent && p.apiKeyLooksValid}
                        pending={p.apiKeyPresent === undefined}
                      />
                      <span className="font-medium">
                        {p.apiKeyPresent && p.apiKeyLooksValid ? '✓' : '✗'}
                      </span>
                      {p.apiKeyPresent ? (
                        <span className="text-gray-700 dark:text-zinc-300">
                          Key erkannt
                          {p.apiKeyLast4 ? ` • …${p.apiKeyLast4}` : ''}
                        </span>
                      ) : (
                        <span className="text-gray-700 dark:text-zinc-300">
                          Kein Key gefunden
                        </span>
                      )}
                      {p.apiKeySource ? (
                        <span className="text-gray-500 dark:text-zinc-400">
                          ({p.apiKeySource})
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <StatusIcon
                        ok={p.reachable}
                        pending={p.reachable === null && !p.apiKeyPresent}
                      />
                      <span className="font-medium">
                        {p.reachable === true
                          ? '✓'
                          : p.reachable === false
                            ? '✗'
                            : ''}
                      </span>
                      <span className="text-gray-700 dark:text-zinc-300">
                        {p.reachable === true && 'OK'}
                        {p.reachable === false && 'Fehler'}
                        {p.reachable === null &&
                          (p.apiKeyPresent ? 'Prüfung ausstehend' : '—')}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-700 dark:text-zinc-300">
                    {typeof p.modelsCount === 'number' ? p.modelsCount : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <div
                      className="max-w-[36ch] truncate text-gray-600 dark:text-zinc-400"
                      title={p.error || ''}
                    >
                      {p.error ? p.error : '—'}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-gray-500 dark:text-zinc-400">
        Hinweis: Für OpenRouter/DeepSeek wird ein OpenAI‑kompatibles SDK
        genutzt. Keys werden nur auf Vorhandensein/Format geprüft und eine
        einfache API‑Route getestet.
      </div>
    </div>
  );
}
