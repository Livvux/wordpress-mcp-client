import { createSession } from '@/lib/session-server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const redirectUrl = searchParams.get('redirectUrl') || '/';
  
  try {
    // Create a new guest session without database dependencies
    await createSession('guest');
    
    // Redirect to the requested URL
    return NextResponse.redirect(new URL(redirectUrl, request.url));
  } catch (error) {
    console.error('Failed to create guest session:', error);
    
    // If session creation fails, still redirect but the middleware will catch it
    return NextResponse.redirect(new URL(redirectUrl, request.url));
  }
}
