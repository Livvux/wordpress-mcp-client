CREATE TABLE IF NOT EXISTS "DeviceLink" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userCode" varchar(16) NOT NULL,
	"deviceCode" varchar(64) NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"approvedAt" timestamp,
	"consumedAt" timestamp,
	"siteUrl" text,
	"jwtEncrypted" text,
	"writeMode" boolean DEFAULT false NOT NULL,
	"pluginVersion" varchar(64)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "DeviceLink_user_code_unique" ON "DeviceLink" USING btree ("userCode");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "DeviceLink_device_code_unique" ON "DeviceLink" USING btree ("deviceCode");