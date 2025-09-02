-- DeviceLink table for device-code onboarding
CREATE TABLE IF NOT EXISTS "DeviceLink" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userCode" varchar(16) NOT NULL,
  "deviceCode" varchar(64) NOT NULL,
  "status" varchar NOT NULL DEFAULT 'pending',
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "expiresAt" timestamp NOT NULL,
  "approvedAt" timestamp,
  "consumedAt" timestamp,

  "siteUrl" text,
  "jwtEncrypted" text,
  "writeMode" boolean NOT NULL DEFAULT false,
  "pluginVersion" varchar(64)
);

CREATE UNIQUE INDEX IF NOT EXISTS "DeviceLink_user_code_unique" ON "DeviceLink" ("userCode");
CREATE UNIQUE INDEX IF NOT EXISTS "DeviceLink_device_code_unique" ON "DeviceLink" ("deviceCode");
