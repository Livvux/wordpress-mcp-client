-- Organizations
CREATE TABLE IF NOT EXISTS "Organization" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(128) NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

-- Organization members
CREATE TABLE IF NOT EXISTS "OrganizationMember" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "orgId" uuid NOT NULL REFERENCES "Organization"("id"),
  "userId" uuid NOT NULL REFERENCES "User"("id"),
  "role" varchar(24) NOT NULL DEFAULT 'viewer',
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationMember_org_user_unique"
  ON "OrganizationMember" ("orgId", "userId");

-- Sites (per organization)
CREATE TABLE IF NOT EXISTS "Site" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "orgId" uuid NOT NULL REFERENCES "Organization"("id"),
  "name" varchar(128) NOT NULL,
  "baseUrl" text NOT NULL,
  "status" varchar NOT NULL DEFAULT 'active',
  "plan" varchar(32) NOT NULL DEFAULT 'free',
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "Site_org_url_unique"
  ON "Site" ("orgId", "baseUrl");

-- Site scopes
CREATE TABLE IF NOT EXISTS "SiteScope" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "siteId" uuid NOT NULL REFERENCES "Site"("id"),
  "scope" varchar(64) NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "SiteScope_site_scope_unique"
  ON "SiteScope" ("siteId", "scope");

-- Site tokens (public key material)
CREATE TABLE IF NOT EXISTS "SiteToken" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "siteId" uuid NOT NULL REFERENCES "Site"("id"),
  "kid" varchar(64) NOT NULL,
  "publicKey" text NOT NULL,
  "expiresAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "SiteToken_site_kid_unique"
  ON "SiteToken" ("siteId", "kid");

-- Approvals
CREATE TABLE IF NOT EXISTS "Approval" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "siteId" uuid NOT NULL REFERENCES "Site"("id"),
  "type" varchar(64) NOT NULL,
  "payloadHash" varchar(128) NOT NULL,
  "status" varchar NOT NULL DEFAULT 'pending',
  "approvedBy" uuid REFERENCES "User"("id"),
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "Approval_site_payload_unique"
  ON "Approval" ("siteId", "payloadHash");

-- Jobs
CREATE TABLE IF NOT EXISTS "Job" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "siteId" uuid NOT NULL REFERENCES "Site"("id"),
  "type" varchar(64) NOT NULL,
  "status" varchar NOT NULL DEFAULT 'queued',
  "progress" integer NOT NULL DEFAULT 0,
  "meta" json NOT NULL DEFAULT '{}',
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);
