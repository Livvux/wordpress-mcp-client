import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth-simple';
import { requireOwnerOrAdmin } from '@/lib/rbac';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await requireOwnerOrAdmin({
      userId: session.user.id,
      email: session.user.email ?? null,
    });

    if (!process.env.POSTGRES_URL) {
      return NextResponse.json(
        { error: 'POSTGRES_URL is not configured' },
        { status: 400 },
      );
    }

    const client = postgres(process.env.POSTGRES_URL);
    const db = drizzle(client);
    await migrate(db as any, { migrationsFolder: './lib/db/migrations' });
    await client.end();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Migration failed' },
      { status: 500 },
    );
  }
}
