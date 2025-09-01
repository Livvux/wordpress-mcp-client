import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { MCPClient } from '@/lib/mcp/client';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const wpBase = cookieStore.get('wp_base')?.value;
    const wpJwt = cookieStore.get('wp_jwt')?.value;
    if (!wpBase || !wpJwt) {
      return NextResponse.json({ error: 'Not connected' }, { status: 401 });
    }
    const client = new MCPClient(wpBase, wpJwt);
    const init = await client.initialize();
    const pluginVersion =
      init?.serverInfo?.version || init?.pluginVersion || null;
    const toolsHash = init?.capabilities?.toolsHash || null;
    return NextResponse.json({ pluginVersion, toolsHash, init });
  } catch (error) {
    console.error('Error fetching MCP meta:', error);
    return NextResponse.json(
      { error: 'Failed to fetch meta' },
      { status: 500 },
    );
  }
}
