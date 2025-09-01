-- Adjust WordPressConnection uniqueness to support multi-site per user
DO $$ BEGIN
  ALTER TABLE "WordPressConnection" DROP CONSTRAINT IF EXISTS "WordPressConnection_user_unique";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  DROP INDEX IF EXISTS "WordPressConnection_user_unique";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "WordPressConnection_user_site_unique"
  ON "WordPressConnection" ("userId", "siteUrl");

-- Create Subscription table for premium entitlements
CREATE TABLE IF NOT EXISTS "Subscription" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES "User"("id"),
  "stripeCustomerId" text,
  "stripeSubscriptionId" text,
  "status" varchar(32) NOT NULL DEFAULT 'inactive',
  "currentPeriodEnd" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_customer_unique"
  ON "Subscription" ("stripeCustomerId");

CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_subscription_unique"
  ON "Subscription" ("stripeSubscriptionId");

