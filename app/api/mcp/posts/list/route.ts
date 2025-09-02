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

    const body = await request.json().catch(() => ({}));
    const status = typeof body.status === 'string' ? body.status : 'any';
    const perPage = Number.isFinite(body.perPage)
      ? Math.max(1, Math.min(50, body.perPage))
      : 10;

    const client = new MCPClient(wpBase, wpJwt);
    await client.initialize();
    const result = await client.callTool('posts.list', { status, perPage });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching posts via MCP:', error);
    return NextResponse.json(
      { error: 'Failed to fetch posts' },
      { status: 500 },
    );
  }
}
