-- Create Account table for OAuth provider linking (NextAuth/Auth.js compatible)
CREATE TABLE IF NOT EXISTS "Account" (
  "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "type" varchar(32) NOT NULL,
  "provider" varchar(64) NOT NULL,
  "providerAccountId" varchar(128) NOT NULL,
  "refresh_token" text,
  "access_token" text,
  "expires_at" integer,
  "token_type" varchar(32),
  "scope" text,
  "id_token" text,
  "session_state" text,
  CONSTRAINT account_pk PRIMARY KEY ("provider", "providerAccountId")
);

-- Helpful index for querying a user's linked accounts
CREATE INDEX IF NOT EXISTS account_user_idx ON "Account" ("userId");

