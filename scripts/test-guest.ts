import { config } from 'dotenv';
config({ path: '.env.local' });

import { getOrCreateGuestUser } from '../lib/db/queries';

async function main() {
  try {
    const user = await getOrCreateGuestUser('guest_test');
    console.log('Created/loaded user:', user);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
