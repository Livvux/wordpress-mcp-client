import { NextResponse } from 'next/server';
import { GET as NEXTAUTH_GET, POST as NEXTAUTH_POST } from '@/app/(auth)/auth';

export async function GET(request: Request) {
  if (process.env.AUTH_ENABLED !== 'true') {
    const url = new URL(request.url);
    const redirectUrl = encodeURIComponent(url.searchParams.get('callbackUrl') || '/');
    return NextResponse.redirect(new URL(`/api/auth/guest?redirectUrl=${redirectUrl}`, request.url));
  }
  return NEXTAUTH_GET(request as any);
}

export async function POST(request: Request) {
  if (process.env.AUTH_ENABLED !== 'true') {
    return GET(request);
  }
  return NEXTAUTH_POST(request as any);
}
