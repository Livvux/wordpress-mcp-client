import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { MCPClient } from '@/lib/mcp/client';
import { z } from 'zod';

const requestSchema = z.object({
  name: z.string(),
  arguments: z.any().optional(),
});

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const wpBase = cookieStore.get('wp_base')?.value;
    const wpJwt = cookieStore.get('wp_jwt')?.value;
    const writeMode = cookieStore.get('wp_write_mode')?.value === '1';

    if (!wpBase || !wpJwt) {
      return NextResponse.json(
        { error: 'WordPress not connected' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, arguments: args } = requestSchema.parse(body);

    // Check if this is a write operation and if write mode is enabled
    const writeOperations = ['create', 'update', 'delete', 'edit', 'publish', 'trash'];
    const isWriteOperation = writeOperations.some(op => name.toLowerCase().includes(op));
    
    if (isWriteOperation && !writeMode) {
      return NextResponse.json(
        { error: 'Write mode is disabled. Enable it to perform write operations.' },
        { status: 403 }
      );
    }

    const client = new MCPClient(wpBase, wpJwt);
    const result = await client.callTool(name, args);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error calling MCP tool:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to call tool' },
      { status: 500 }
    );
  }
}