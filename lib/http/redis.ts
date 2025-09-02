import { createClient, type RedisClientType } from '@redis/client';

let client: RedisClientType | null = null;
let connecting: Promise<void> | null = null;

export function getRedis(): RedisClientType | null {
  if (!process.env.REDIS_URL) return null;
  if (client) return client;
  client = createClient({ url: process.env.REDIS_URL });
  client.on('error', (err) => {
    console.warn('[redis] error', err);
  });
  connecting = client.connect().catch((err) => {
    console.warn('[redis] connect error', err);
  });
  return client;
}

export async function ensureRedis(): Promise<RedisClientType | null> {
  const c = getRedis();
  if (!c) return null;
  if (connecting) await connecting.catch(() => {});
  return c;
}
