import { NextResponse } from 'next/server';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { site } from '@/lib/db/schema';

export async function GET(request: Request) {
  const url = process.env.POSTGRES_URL;
  if (!url) return NextResponse.json({ error: 'DB disabled' }, { status: 503 });
  const client = postgres(url);
  const db = drizzle(client);
  try {
    const rows = await db.select().from(site);
    return NextResponse.json({ items: rows });
  } finally {
    await client.end();
  }
}

export async function POST(request: Request) {
  const url = process.env.POSTGRES_URL;
  if (!url) return NextResponse.json({ error: 'DB disabled' }, { status: 503 });
  const client = postgres(url);
  const db = drizzle(client);
  try {
    const body = await request.json().catch(() => ({}));
    const orgId = String(body.orgId || '').trim();
    const name = String(body.name || '').trim();
    const baseUrl = String(body.baseUrl || '').trim();
    if (!orgId || !name || !baseUrl) {
      return NextResponse.json(
        { error: 'orgId, name, baseUrl required' },
        { status: 400 },
      );
    }
    const [row] = await db
      .insert(site)
      .values({ orgId, name, baseUrl })
      .returning();
    return NextResponse.json(row, { status: 201 });
  } finally {
    await client.end();
  }
}
