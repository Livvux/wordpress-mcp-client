import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env.local' });

async function resetDb() {
  const url = process.env.POSTGRES_URL;
  if (!url) throw new Error('POSTGRES_URL is not defined');

  const u = new URL(url);
  const dbName = (u.pathname || '/wpagentic').slice(1) || 'wpagentic';

  // Connect to admin DB
  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';
  const admin = postgres(adminUrl.toString(), { max: 1 });
  try {
    // terminate connections and drop if exists
    await admin`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${dbName} AND pid <> pg_backend_pid();`;
    await admin.unsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
    await admin.unsafe(`CREATE DATABASE "${dbName}"`);
    console.log(`✅ Reset database ${dbName}`);
  } finally {
    await admin.end({ timeout: 1 });
  }

  // Ensure pgcrypto in target DB
  const target = postgres(url, { max: 1 });
  try {
    await target.unsafe('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    console.log('✅ Ensured pgcrypto extension');
  } finally {
    await target.end({ timeout: 1 });
  }
}

resetDb().catch((err) => {
  console.error('❌ DB reset failed');
  console.error(err);
  process.exit(1);
});
