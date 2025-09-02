import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Lightweight Drizzle client for Auth.js adapter usage
// Reuses POSTGRES_URL; migrations are handled elsewhere.
let _db: ReturnType<typeof drizzle> | null = null;

export function getAuthDb() {
  if (_db) return _db;
  if (!process.env.POSTGRES_URL) {
    throw new Error('POSTGRES_URL is required for account linking');
  }
  const client = postgres(process.env.POSTGRES_URL);
  _db = drizzle(client);
  return _db;
}

