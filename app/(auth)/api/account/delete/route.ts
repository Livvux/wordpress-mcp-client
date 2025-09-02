import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/app/(auth)/auth-simple';
import { deleteUserAccountCascade, getUserById } from '@/lib/db/queries';
import { compare } from 'bcrypt-ts';
import { DUMMY_PASSWORD } from '@/lib/constants';
import { deleteSession } from '@/lib/session-server';

const schema = z.object({
  password: z.string().min(1),
  confirm: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }
    const { password, confirm } = schema.parse(await request.json());
    if (password !== confirm) {
      return NextResponse.json(
        { ok: false, error: 'Passwords do not match' },
        { status: 400 },
      );
    }
    const dbUser = await getUserById(session.user.id);
    if (!dbUser || !dbUser.password) {
      await compare(password, DUMMY_PASSWORD);
      return NextResponse.json(
        { ok: false, error: 'Invalid password' },
        { status: 400 },
      );
    }
    const ok = await compare(password, dbUser.password);
    if (!ok) {
      return NextResponse.json(
        { ok: false, error: 'Invalid password' },
        { status: 400 },
      );
    }

    await deleteUserAccountCascade(session.user.id);
    await deleteSession();
    const res = NextResponse.json({ ok: true });
    try {
      res.cookies.set('wp_base', '', { maxAge: 0, path: '/' });
      res.cookies.set('wp_jwt', '', { maxAge: 0, path: '/' });
      res.cookies.set('wp_refresh', '', { maxAge: 0, path: '/' });
      res.cookies.set('wp_write_mode', '', { maxAge: 0, path: '/' });
    } catch {}
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
