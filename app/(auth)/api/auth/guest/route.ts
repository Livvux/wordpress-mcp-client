import { NextResponse } from 'next/server';
import { signIn } from '@/app/(auth)/auth';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const redirectUrl = url.searchParams.get('redirectUrl') || '/';
    // Trigger guest sign-in using the Credentials provider with id 'guest'
    const res = await signIn('guest', { redirectTo: redirectUrl });
    // signIn returns a Response (usually a redirect) in route handlers
    return res as any;
  } catch (e) {
    return NextResponse.redirect(new URL('/', request.url));
  }
}

