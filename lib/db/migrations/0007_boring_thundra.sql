CREATE TABLE IF NOT EXISTS "AIIntegration" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"provider" varchar(64) NOT NULL,
	"model" varchar(128) NOT NULL,
	"apiKeyEncrypted" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastUsedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Approval" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"siteId" uuid NOT NULL,
	"type" varchar(64) NOT NULL,
	"payloadHash" varchar(128) NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"approvedBy" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"siteId" uuid NOT NULL,
	"type" varchar(64) NOT NULL,
	"status" varchar DEFAULT 'queued' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"meta" json DEFAULT '{}'::json NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Organization" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "OrganizationMember" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"orgId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"role" varchar(24) DEFAULT 'viewer' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Site" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"orgId" uuid NOT NULL,
	"name" varchar(128) NOT NULL,
	"baseUrl" text NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"plan" varchar(32) DEFAULT 'free' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "SiteScope" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"siteId" uuid NOT NULL,
	"scope" varchar(64) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "SiteToken" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"siteId" uuid NOT NULL,
	"kid" varchar(64) NOT NULL,
	"publicKey" text NOT NULL,
	"expiresAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"stripeCustomerId" text,
	"stripeSubscriptionId" text,
	"status" varchar(32) DEFAULT 'inactive' NOT NULL,
	"currentPeriodEnd" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"kind" varchar(64) NOT NULL,
	"params" json NOT NULL,
	"status" varchar DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"lastError" text,
	"runAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "WordPressConnection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"siteUrl" text NOT NULL,
	"jwtEncrypted" text NOT NULL,
	"writeMode" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastUsedAt" timestamp,
	"lastValidatedAt" timestamp,
	"expiresAt" timestamp,
	"status" varchar DEFAULT 'active' NOT NULL,
	"fingerprint" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "WPActionLog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"siteUrl" text NOT NULL,
	"action" varchar(64) NOT NULL,
	"requestMeta" json NOT NULL,
	"responseMeta" json NOT NULL,
	"status" varchar DEFAULT 'success' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "AIIntegration" ADD CONSTRAINT "AIIntegration_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Approval" ADD CONSTRAINT "Approval_siteId_Site_id_fk" FOREIGN KEY ("siteId") REFERENCES "public"."Site"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Approval" ADD CONSTRAINT "Approval_approvedBy_User_id_fk" FOREIGN KEY ("approvedBy") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Job" ADD CONSTRAINT "Job_siteId_Site_id_fk" FOREIGN KEY ("siteId") REFERENCES "public"."Site"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_orgId_Organization_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Site" ADD CONSTRAINT "Site_orgId_Organization_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "SiteScope" ADD CONSTRAINT "SiteScope_siteId_Site_id_fk" FOREIGN KEY ("siteId") REFERENCES "public"."Site"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "SiteToken" ADD CONSTRAINT "SiteToken_siteId_Site_id_fk" FOREIGN KEY ("siteId") REFERENCES "public"."Site"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "WordPressConnection" ADD CONSTRAINT "WordPressConnection_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "WPActionLog" ADD CONSTRAINT "WPActionLog_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "AIIntegration_user_provider_unique" ON "AIIntegration" USING btree ("userId","provider");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Approval_site_payload_unique" ON "Approval" USING btree ("siteId","payloadHash");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Job_site_type_id_unique" ON "Job" USING btree ("id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationMember_org_user_unique" ON "OrganizationMember" USING btree ("orgId","userId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Site_org_url_unique" ON "Site" USING btree ("orgId","baseUrl");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "SiteScope_site_scope_unique" ON "SiteScope" USING btree ("siteId","scope");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "SiteToken_site_kid_unique" ON "SiteToken" USING btree ("siteId","kid");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_customer_unique" ON "Subscription" USING btree ("stripeCustomerId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_subscription_unique" ON "Subscription" USING btree ("stripeSubscriptionId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "WordPressConnection_user_site_unique" ON "WordPressConnection" USING btree ("userId","siteUrl");