CREATE TABLE IF NOT EXISTS "GlobalAIConfig" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" varchar(64) NOT NULL,
  "model" varchar(128) NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

-- Optional: ensure only one row is practically used by updating the most recent one.
-- Application logic will update the latest row or insert if none exists.

