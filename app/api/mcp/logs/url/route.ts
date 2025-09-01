import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { MCPClient } from '@/lib/mcp/client';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const wpBase = cookieStore.get('wp_base')?.value;
    const wpJwt = cookieStore.get('wp_jwt')?.value;
    if (!wpBase || !wpJwt) {
      return NextResponse.json(
        { error: 'WordPress not connected' },
        { status: 401 },
      );
    }
    const client = new MCPClient(wpBase, wpJwt);
    await client.initialize();
    const result = await client.callTool('logs.tail', {});
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error getting logs tail URL:', error);
    return NextResponse.json(
      { error: 'Failed to get logs tail URL' },
      { status: 500 },
    );
  }
}
