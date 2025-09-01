-- Add additional metadata columns to AIIntegration
ALTER TABLE "AIIntegration"
  ADD COLUMN IF NOT EXISTS "lastUsedAt" timestamp;

-- Extend WordPressConnection with lifecycle fields
ALTER TABLE "WordPressConnection"
  ADD COLUMN IF NOT EXISTS "lastUsedAt" timestamp,
  ADD COLUMN IF NOT EXISTS "lastValidatedAt" timestamp,
  ADD COLUMN IF NOT EXISTS "expiresAt" timestamp,
  ADD COLUMN IF NOT EXISTS "status" varchar NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "fingerprint" text;

-- Create WPActionLog table
CREATE TABLE IF NOT EXISTS "WPActionLog" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES "User"("id"),
  "siteUrl" text NOT NULL,
  "action" varchar(64) NOT NULL,
  "requestMeta" json NOT NULL,
  "responseMeta" json NOT NULL,
  "status" varchar NOT NULL DEFAULT 'success',
  "createdAt" timestamp NOT NULL DEFAULT now()
);

-- Create Task table
CREATE TABLE IF NOT EXISTS "Task" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES "User"("id"),
  "kind" varchar(64) NOT NULL,
  "params" json NOT NULL,
  "status" varchar NOT NULL DEFAULT 'queued',
  "attempts" integer NOT NULL DEFAULT 0,
  "lastError" text,
  "runAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

