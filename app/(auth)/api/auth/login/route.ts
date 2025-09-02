import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUser } from '@/lib/db/queries';
import { compare } from 'bcrypt-ts';
import { DUMMY_PASSWORD } from '@/lib/constants';
import { createSessionForUser } from '@/lib/session-server';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const { email, password } = schema.parse(await request.json());
    const users = await getUser(email);
    if (users.length === 0) {
      // Normalize timing
      await compare(password, DUMMY_PASSWORD);
      return NextResponse.json(
        { ok: false, error: 'Invalid email or password' },
        { status: 401 },
      );
    }
    const [user] = users;
    if (!user.password) {
      await compare(password, DUMMY_PASSWORD);
      return NextResponse.json(
        { ok: false, error: 'Invalid email or password' },
        { status: 401 },
      );
    }
    const ok = await compare(password, user.password);
    if (!ok) {
      return NextResponse.json(
        { ok: false, error: 'Invalid email or password' },
        { status: 401 },
      );
    }

    await createSessionForUser(user.id, 'regular', email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
