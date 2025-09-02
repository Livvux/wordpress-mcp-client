import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const VERSION = '0.1.0';

export async function GET(request: Request) {
  const envOrigin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  const url = new URL(request.url);
  const requestOrigin = `${url.protocol}//${url.host}`;
  const origin = envOrigin || requestOrigin;
  const downloadUrl = `${origin}/releases/wp-cursor-${VERSION}.zip`;

  // Try to compute SHA-256 over the ZIP in /public
  let checksum: string | undefined;
  try {
    const zipAbsPath = path.join(
      process.cwd(),
      'public',
      'releases',
      `wp-cursor-${VERSION}.zip`,
    );
    if (existsSync(zipAbsPath)) {
      const buf = readFileSync(zipAbsPath);
      checksum = createHash('sha256').update(buf).digest('hex');
    }
  } catch {
    // ignore; manifest can be served without checksum
  }

  return NextResponse.json(
    {
      version: VERSION,
      downloadUrl,
      checksum,
      minAppVersion: '0.1.0',
      requires: '6.1',
      tested: '6.6',
      changelog: `Initial skeleton with read-only MCP tools and admin console`,
    },
    { status: 200 },
  );
}
