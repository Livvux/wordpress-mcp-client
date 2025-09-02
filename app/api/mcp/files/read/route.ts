import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { MCPClient } from '@/lib/mcp/client';
import { isAllowedOrigin } from '@/lib/security';

export async function POST(request: Request) {
  try {
    if (!isAllowedOrigin(request)) {
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
    }
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
    const res = NextResponse.json(result);
    res.headers.set('Vary', 'Origin');
    return res;
  } catch (error) {
    console.error('Error reading file via MCP:', error);
    const res = NextResponse.json(
      { error: 'Failed to read file' },
      { status: 500 },
    );
    res.headers.set('Vary', 'Origin');
    return res;
  }
}
