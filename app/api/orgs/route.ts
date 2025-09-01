import { NextResponse } from 'next/server';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { organization } from '@/lib/db/schema';

export async function GET() {
  const url = process.env.POSTGRES_URL;
  if (!url) return NextResponse.json({ error: 'DB disabled' }, { status: 503 });
  const client = postgres(url);
  const db = drizzle(client);
  try {
    const rows = await db.select().from(organization);
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
    const name = String(body.name || '').trim();
    if (!name)
      return NextResponse.json({ error: 'name required' }, { status: 400 });
    const [row] = await db.insert(organization).values({ name }).returning();
    return NextResponse.json(row, { status: 201 });
  } finally {
    await client.end();
  }
}
