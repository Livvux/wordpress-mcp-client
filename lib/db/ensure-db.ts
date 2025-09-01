import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env.local' });

async function ensureDb() {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    console.error('POSTGRES_URL is not defined');
    process.exit(1);
  }
  const u = new URL(url);
  const targetDb = (u.pathname || '/wpagentic').slice(1) || 'wpagentic';

  // connect to default 'postgres' database on same host/port/user
  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';

  const admin = postgres(adminUrl.toString(), { max: 1 });
  try {
    const exists = await admin`
      SELECT 1 FROM pg_database WHERE datname = ${targetDb}
    `;
    if (exists.length === 0) {
      await admin.unsafe(`CREATE DATABASE "${targetDb}"`);
      console.log(`✅ Created database ${targetDb}`);
    } else {
      console.log(`ℹ️  Database ${targetDb} already exists`);
    }
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

ensureDb().catch((err) => {
  console.error('❌ Failed ensuring database');
  console.error(err);
  process.exit(1);
});

