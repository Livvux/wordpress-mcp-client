import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { MCPClient } from '@/lib/mcp/client';

export async function POST(request: Request) {
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

    const body = await request.json();
    const path = typeof body.path === 'string' ? body.path : '';
    if (!path) {
      return NextResponse.json({ error: 'Missing path' }, { status: 400 });
    }

    const client = new MCPClient(wpBase, wpJwt);
    await client.initialize();
    const result = await client.callTool('files.read', { path });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error reading file via MCP:', error);
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 });
  }
}
