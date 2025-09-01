// Thin wrappers to call our internal REST endpoints instead of direct MCP plugin.

export async function validateWPConnection(siteUrl: string, jwt?: string) {
  const res = await fetch('/api/wp/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ siteUrl, jwt }),
  });
  return res.json();
}

export async function createWPPost(params: {
  siteUrl: string;
  jwt?: string;
  title: string;
  content: string;
  status?: 'draft' | 'publish';
  categories?: string[];
  tags?: string[];
  idempotencyKey?: string;
}) {
  const { siteUrl, jwt, ...rest } = params;
  const res = await fetch('/api/wp/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ siteUrl, jwt, ...rest }),
  });
  return res.json();
}

export async function updateWPPost(params: {
  siteUrl: string;
  jwt?: string;
  id: string;
  patch: Partial<{ title: string; content: string; status: 'draft' | 'publish' }>;
}) {
  const { siteUrl, jwt, id, patch } = params;
  const res = await fetch(`/api/wp/posts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ siteUrl, jwt, ...patch }),
  });
  return res.json();
}

export async function previewContent(content: string) {
  const res = await fetch('/api/wp/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  return res.json();
}

