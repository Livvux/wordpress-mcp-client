import { auth } from '@/app/(auth)/auth-simple';
import { requireOwnerOrAdmin } from '@/lib/rbac';
import { getGlobalAIConfig, upsertGlobalAIConfig } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

async function saveConfig(formData: FormData) {
  'use server';
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');
  await requireOwnerOrAdmin({
    userId: session.user.id,
    email: session.user.email ?? null,
  });

  const provider = String(formData.get('provider') || '');
  const chatModel = String(formData.get('chatModel') || '');
  const reasoningModelRaw = formData.get('reasoningModel');
  const reasoningModel = reasoningModelRaw ? String(reasoningModelRaw) : null;

  await upsertGlobalAIConfig({ provider, chatModel, reasoningModel });
}

export default async function AdminAIConfigPage() {
  const session = await auth();
  if (!session?.user) {
    return <div className="p-6">Bitte anmelden.</div>;
  }

  await requireOwnerOrAdmin({
    userId: session.user.id,
    email: session.user.email ?? null,
  });
  const cfg = await getGlobalAIConfig();

  const providers = [
    'openai',
    'anthropic',
    'google',
    'openrouter',
    'deepseek',
    'xai',
  ];

  return (
    <div className="max-w-3xl p-6 space-y-4">
      <h1 className="text-xl font-semibold">Admin: Globale AI-Modelle</h1>
      <p className="text-sm text-gray-600">
        Diese Einstellungen definieren Provider sowie die Modelle für Chat und
        Reasoning systemweit. API-Schlüssel werden über Umgebungsvariablen
        bereitgestellt. Nutzer sehen keine konkreten Modellnamen.
      </p>

      <form action={saveConfig} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="provider" className="block text-sm font-medium">Provider</label>
          <select
            id="provider"
            name="provider"
            defaultValue={cfg?.provider || 'openai'}
            className="border rounded px-2 py-1 w-full"
          >
            {providers.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="chatModel" className="block text-sm font-medium">Chat‑Modell</label>
          <input
            id="chatModel"
            name="chatModel"
            defaultValue={(cfg as any)?.chatModel || (cfg as any)?.model || ''}
            placeholder="z. B. gpt-4o-mini, claude-3-5-sonnet-latest"
            className="border rounded px-2 py-1 w-full"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="reasoningModel" className="block text-sm font-medium">Reasoning‑Modell (optional)</label>
          <input
            id="reasoningModel"
            name="reasoningModel"
            defaultValue={(cfg as any)?.reasoningModel || ''}
            placeholder="z. B. o1-mini, grok-3-mini-beta"
            className="border rounded px-2 py-1 w-full"
          />
        </div>
        <button type="submit" className="bg-black text-white rounded px-3 py-1">
          Speichern
        </button>
      </form>

      {/* Debug & Diagnose */}
      {/* Keep this client component isolated for interactions */}
      <AIDebugSection />
    </div>
  );
}

// Split import to avoid top-level client in server component
// This wrapper lets us include the client component without turning the page into a client component
import AIDebugSection from '@/components/admin/ai-debug-panel';
