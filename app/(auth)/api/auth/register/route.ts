import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createUser, getUser } from '@/lib/db/queries';
import { createSessionForUser } from '@/lib/session-server';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const { email, password } = schema.parse(json);

    const existing = await getUser(email);
    if (existing.length > 0) {
      return NextResponse.json(
        { ok: false, error: 'Email is already registered' },
        { status: 400 },
      );
    }

    const res = await createUser(email, password);
    if (!res) {
      return NextResponse.json(
        { ok: false, error: 'Failed to create user' },
        { status: 500 },
      );
    }

    // Reload user to get ID
    const [user] = await getUser(email);
    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'User not found after creation' },
        { status: 500 },
      );
    }

    await createSessionForUser(user.id, 'regular', email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
