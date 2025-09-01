import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env.local' });

function parseDb(url: string) {
  const u = new URL(url);
  const dbName = (u.pathname || '').replace(/^\//, '') || 'postgres';
  const adminUrl = new URL(u.toString());
  adminUrl.pathname = '/postgres';
  return { dbName, adminUrl: adminUrl.toString() };
}

async function main() {
  const url = process.env.POSTGRES_URL;
  if (!url) throw new Error('POSTGRES_URL is not defined');
  const { dbName, adminUrl } = parseDb(url);
  const sql = postgres(adminUrl, { max: 1 });
  try {
    await sql`CREATE DATABASE ${sql(dbName)}`;
    console.log(`Created database ${dbName}`);
  } catch (e: any) {
    if (e && e.code === '42P04') {
      console.log(`Database ${dbName} already exists`);
    } else {
      console.error('Failed to create database:', e);
      process.exit(1);
    }
  } finally {
    await sql.end({ timeout: 1 });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

