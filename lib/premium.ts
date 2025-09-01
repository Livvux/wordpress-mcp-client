import { PREMIUM_REQUIRE_SUBSCRIPTION } from '@/lib/config';
import type { Session } from '@/lib/session-server';

// TODO: Replace with real entitlement lookup (Stripe webhook + DB store)
export async function hasPremium(_session: Session | null): Promise<boolean> {
  if (!PREMIUM_REQUIRE_SUBSCRIPTION) return true;
  // Placeholder: always false when enforcement is on
  return false;
}

