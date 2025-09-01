#!/usr/bin/env tsx
import { createHash } from 'node:crypto';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import archiver from 'archiver';

const root = process.cwd();
const pluginDir = path.join(root, 'plugins', 'wp-cursor');
const outDir = path.join(root, 'public', 'releases');
const version = '0.1.0';
const zipName = `wp-cursor-${version}.zip`;
const zipPath = path.join(outDir, zipName);

async function main() {
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const output = createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.directory(pluginDir, 'wp-cursor');
  await new Promise<void>((resolve, reject) => {
    output.on('close', () => resolve());
    archive.on('error', (err) => reject(err));
    archive.pipe(output);
    archive.finalize();
  });

  const buf = readFileSync(zipPath);
  const sha256 = createHash('sha256').update(buf).digest('hex');

  const manifest = {
    version,
    downloadUrl: `/releases/${zipName}`,
    checksum: sha256,
    minAppVersion: '0.1.0',
    requires: '6.1',
    tested: '6.6',
    changelog: `Initial skeleton with read-only MCP tools and admin console.`,
  };

  const manifestPath = path.join(root, 'public', 'updates.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log('Wrote:', { zipPath, manifestPath });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
