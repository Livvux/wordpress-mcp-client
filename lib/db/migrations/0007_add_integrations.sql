-- Ensure UUID generation is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- AIIntegration table for storing per-user AI provider configuration (server-side)
CREATE TABLE IF NOT EXISTS "AIIntegration" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES "User"("id"),
  "provider" varchar(64) NOT NULL,
  "model" varchar(128) NOT NULL,
  "apiKeyEncrypted" text NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "AIIntegration_user_provider_unique"
  ON "AIIntegration" ("userId", "provider");

-- WordPressConnection table for storing per-user WP site connection (server-side)
CREATE TABLE IF NOT EXISTS "WordPressConnection" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES "User"("id"),
  "siteUrl" text NOT NULL,
  "jwtEncrypted" text NOT NULL,
  "writeMode" boolean NOT NULL DEFAULT false,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "WordPressConnection_user_unique"
  ON "WordPressConnection" ("userId");
