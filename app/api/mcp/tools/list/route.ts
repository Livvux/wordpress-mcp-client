import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { MCPClient } from '@/lib/mcp/client';

export async function POST() {
  try {
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

    const client = new MCPClient(wpBase, wpJwt);

    // First initialize the connection
    console.log('Initializing MCP client...');
    await client.initialize();

    console.log('Listing tools...');
    const tools = await client.listTools();

    console.log('Tools retrieved:', { count: tools.tools?.length || 0 });

    return NextResponse.json(tools);
  } catch (error) {
    console.error('Error listing MCP tools:', error);

    let errorMessage = 'Failed to list tools';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
