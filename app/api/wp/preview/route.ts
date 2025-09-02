import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { AUTH_ENABLED } from '@/lib/config';

function basicSanitize(html: string): string {
  // extremely conservative: strip <script> and on* attributes
  let out = html.replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script>/gi, '');
  out = out.replace(/ on[a-z]+\s*=\s*"[^"]*"/gi, '');
  out = out.replace(/ on[a-z]+\s*=\s*'[^']*'/gi, '');
  out = out.replace(/ on[a-z]+\s*=\s*[^\s>]+/gi, '');
  return out;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session && AUTH_ENABLED) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { content } = await request.json().catch(() => ({ content: null }));
  if (!content) {
    return NextResponse.json({ error: 'Missing content' }, { status: 400 });
  }

  const sanitized = basicSanitize(String(content));
  // In OSS and Premium alike, provide a lightweight preview response.
  // Deeper SSR/validation (links, schema.org) can extend this endpoint later.
  return NextResponse.json(
    { ok: true, preview: { html: sanitized } },
    { status: 200 },
  );
}
