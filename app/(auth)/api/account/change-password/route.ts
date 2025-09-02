import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/app/(auth)/auth-simple';
import { getUserById, updateUserPassword } from '@/lib/db/queries';
import { compare } from 'bcrypt-ts';
import { DUMMY_PASSWORD } from '@/lib/constants';

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
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

    const { currentPassword, newPassword } = schema.parse(await request.json());
    const dbUser = await getUserById(session.user.id);
    if (!dbUser || !dbUser.password) {
      // normalize timing
      await compare(currentPassword, DUMMY_PASSWORD);
      return NextResponse.json(
        { ok: false, error: 'Invalid current password' },
        { status: 400 },
      );
    }
    const ok = await compare(currentPassword, dbUser.password);
    if (!ok) {
      return NextResponse.json(
        { ok: false, error: 'Invalid current password' },
        { status: 400 },
      );
    }

    await updateUserPassword(session.user.id, newPassword);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
