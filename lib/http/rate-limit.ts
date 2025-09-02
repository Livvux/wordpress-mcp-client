import { ensureRedis } from './redis';

const FALLBACK = new Map<string, { resetAt: number; count: number }>();

export async function rateLimit({
  key,
  windowMs,
  max,
}: {
  key: string;
  windowMs: number;
  max: number;
}): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const redis = await ensureRedis();
  const now = Date.now();
  if (redis) {
    const bucket = `rl:v1:${key}`;
    const tx = redis.multi();
    tx.incr(bucket);
    tx.pttl(bucket);
    const [incrRes, ttlRes] = (await tx.exec()) as [number, number];
    const count = Number(incrRes || 0);
    let pttl = Number(ttlRes || -1);
    if (pttl < 0) {
      await redis.pexpire(bucket, windowMs);
      pttl = windowMs;
    }
    const allowed = count <= max;
    return {
      allowed,
      remaining: Math.max(0, max - count),
      resetAt: now + pttl,
    };
  }
  const rec = FALLBACK.get(key);
  if (!rec || rec.resetAt < now) {
    FALLBACK.set(key, { resetAt: now + windowMs, count: 1 });
    return { allowed: true, remaining: max - 1, resetAt: now + windowMs };
  }
  rec.count += 1;
  const allowed = rec.count <= max;
  return {
    allowed,
    remaining: Math.max(0, max - rec.count),
    resetAt: rec.resetAt,
  };
}
