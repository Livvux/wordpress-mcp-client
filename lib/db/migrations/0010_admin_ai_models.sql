-- Add admin-configurable chat and reasoning models to GlobalAIConfig
ALTER TABLE "GlobalAIConfig"
  ADD COLUMN IF NOT EXISTS "chatModel" varchar(128),
  ADD COLUMN IF NOT EXISTS "reasoningModel" varchar(128);

-- Backfill chatModel from legacy model column where empty
UPDATE "GlobalAIConfig"
SET "chatModel" = COALESCE("chatModel", "model")
WHERE "chatModel" IS NULL;

-- Keep legacy "model" for compatibility; new code prefers chatModel/reasoningModel

