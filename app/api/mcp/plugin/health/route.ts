import { NextResponse } from 'next/server';
import { z } from 'zod';

const bodySchema = z.object({
  siteUrl: z.string().url(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const { siteUrl } = bodySchema.parse(json);
    const base = siteUrl.replace(/\/$/, '');
    const url = `${base}/wp-json/wpcursor/v1/health`;

    const res = await fetch(url, { method: 'GET', cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, status: res.status, message: res.statusText },
        { status: 200 },
      );
    }
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(
      {
        ok: true,
        pluginVersion: data?.pluginVersion ?? null,
        protocolVersion: data?.protocolVersion ?? null,
        schemaVersion: data?.schemaVersion ?? null,
        capabilities: data?.capabilities ?? null,
        environment: data?.environment ?? null,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: 'Failed to probe plugin health' },
      { status: 200 },
    );
  }
}
