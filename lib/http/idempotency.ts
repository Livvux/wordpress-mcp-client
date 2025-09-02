import { createHash, randomUUID } from 'node:crypto';
import { ensureRedis } from './redis';

type CacheRecord = {
  status: number;
  headers?: Record<string, string>;
  body: any;
};

const FALLBACK = new Map<string, { expiresAt: number; record: CacheRecord }>();

function hashBody(body: unknown): string {
  try {
    const json = typeof body === 'string' ? body : JSON.stringify(body ?? {});
    return createHash('sha256').update(json).digest('hex');
  } catch {
    return randomUUID().replace(/-/g, '');
  }
}

export function makeIdempotencyKey(route: string, key: string, body: unknown) {
  const bodyHash = hashBody(body);
  return `idem:v1:${route}:${key}:${bodyHash}`;
}

export async function idemGet(cacheKey: string): Promise<CacheRecord | null> {
  const redis = await ensureRedis();
  if (redis) {
    const val = await redis.get(cacheKey);
    if (!val) return null;
    try {
      return JSON.parse(val) as CacheRecord;
    } catch {
      return null;
    }
  }
  const now = Date.now();
  const rec = FALLBACK.get(cacheKey);
  if (!rec) return null;
  if (rec.expiresAt < now) {
    FALLBACK.delete(cacheKey);
    return null;
  }
  return rec.record;
}

export async function idemSet(
  cacheKey: string,
  record: CacheRecord,
  ttlSeconds = 60 * 60 * 24,
): Promise<void> {
  const redis = await ensureRedis();
  const payload = JSON.stringify(record);
  if (redis) {
    await redis.set(cacheKey, payload, { EX: ttlSeconds, NX: true });
    return;
  }
  const expiresAt = Date.now() + ttlSeconds * 1000;
  FALLBACK.set(cacheKey, { expiresAt, record });
}

