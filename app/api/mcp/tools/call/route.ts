import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { MCPClient } from '@/lib/mcp/client';
import { z } from 'zod';
import { isAllowedOrigin } from '@/lib/security';

const requestSchema = z.object({
  name: z.string(),
  arguments: z.any().optional(),
});

export async function POST(request: Request) {
  try {
    if (!isAllowedOrigin(request)) {
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
    }
    const cookieStore = await cookies();
    const wpBase = cookieStore.get('wp_base')?.value;
    const wpJwt = cookieStore.get('wp_jwt')?.value;
    const writeMode = cookieStore.get('wp_write_mode')?.value === '1';

    if (!wpBase || !wpJwt) {
      return NextResponse.json(
        { error: 'WordPress not connected' },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { name, arguments: args } = requestSchema.parse(body);

    // Check if this is a write operation and if write mode is enabled
    const writeOperations = [
      'create',
      'update',
      'delete',
      'edit',
      'publish',
      'trash',
    ];
    const isWriteOperation = writeOperations.some((op) =>
      name.toLowerCase().includes(op),
    );

    if (isWriteOperation && !writeMode) {
      return NextResponse.json(
        {
          error:
            'Write mode is disabled. Enable it to perform write operations.',
        },
        { status: 403 },
      );
    }

    let client = new MCPClient(wpBase, wpJwt);
    let result: unknown;
    try {
      result = await client.callTool(name, args);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e ?? '');
      if (msg.includes('401') || msg.toLowerCase().includes('unauthorized')) {
        const refreshRes = await fetch('/api/mcp/connection/refresh', {
          method: 'POST',
          cache: 'no-store',
        });
        if (!refreshRes.ok) throw e;
        const refreshData = await refreshRes.json().catch(() => ({} as any));
        const newJwt = typeof refreshData?.accessToken === 'string' && refreshData.accessToken.length > 0
          ? refreshData.accessToken
          : (await cookies()).get('wp_jwt')?.value || '';
        const wpBase2 = (await cookies()).get('wp_base')?.value || wpBase;
        client = new MCPClient(wpBase2, newJwt);
        result = await client.callTool(name, args);
      } else {
        throw e;
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error calling MCP tool:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to call tool' },
      { status: 500 },
    );
  }
}
