export const APP_MODE = process.env.APP_MODE || 'premium';
export const AUTH_ENABLED = process.env.AUTH_ENABLED === 'true';
export const DB_ENABLED =
  process.env.DB_ENABLED !== 'false' && APP_MODE !== 'oss';

export const isOss = APP_MODE === 'oss';
export const isPremium = APP_MODE !== 'oss';

// Premium gating for write features (Stripe-backed in prod)
export const PREMIUM_REQUIRE_SUBSCRIPTION =
  process.env.PREMIUM_REQUIRE_SUBSCRIPTION === 'true';

// Billing/Trials
export const BILLING_ENABLED = process.env.BILLING_ENABLED !== 'false';
export const FREE_TRIAL_DAYS = Number(process.env.FREE_TRIAL_DAYS || 3);
