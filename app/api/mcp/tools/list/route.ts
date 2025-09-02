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

    console.log('Tools list request:', {
      wpBase: `${wpBase?.substring(0, 50)}...`,
      hasJwt: !!wpJwt,
    });

    if (!wpBase || !wpJwt) {
      console.log('Missing credentials for tools list');
      return NextResponse.json(
        { error: 'WordPress not connected' },
        { status: 401 },
      );
    }

    let client = new MCPClient(wpBase, wpJwt);

    // First initialize the connection (retry with refresh if unauthorized)
    console.log('Initializing MCP client...');
    try {
      await client.initialize();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e ?? '');
      if (msg.includes('401') || msg.toLowerCase().includes('unauthorized')) {
        console.log('Initialize unauthorized, attempting refresh...');
        const refreshRes = await fetch('/api/mcp/connection/refresh', {
          method: 'POST',
          cache: 'no-store',
        });
        if (!refreshRes.ok) {
          throw e;
        }
        const refreshData = await refreshRes.json().catch(() => ({}) as any);
        const newJwt =
          typeof refreshData?.accessToken === 'string' &&
          refreshData.accessToken.length > 0
            ? refreshData.accessToken
            : (await cookies()).get('wp_jwt')?.value || '';
        const wpBase2 = (await cookies()).get('wp_base')?.value || wpBase;
        client = new MCPClient(wpBase2, newJwt);
        await client.initialize();
      } else {
        throw e;
      }
    }

    console.log('Listing tools...');
    const tools = await client.listTools();

    console.log('Tools retrieved:', { count: tools.tools?.length || 0 });

    const res = NextResponse.json(tools);
    res.headers.set('Vary', 'Origin');
    return res;
  } catch (error) {
    console.error('Error listing MCP tools:', error);

    let errorMessage = 'Failed to list tools';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    const res = NextResponse.json({ error: errorMessage }, { status: 500 });
    res.headers.set('Vary', 'Origin');
    return res;
  }
}
