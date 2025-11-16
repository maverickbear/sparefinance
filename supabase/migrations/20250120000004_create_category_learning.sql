-- Migration: Create category_learning table for optimized category suggestions
-- This eliminates the need to scan 12 months of transactions for suggestions

-- Step 1: Create table
CREATE TABLE IF NOT EXISTS "category_learning" (
  "user_id" uuid NOT NULL,
  "normalized_description" text NOT NULL,
  "type" text NOT NULL,
  "category_id" text NOT NULL,
  "subcategory_id" text,
  "description_and_amount_count" integer NOT NULL DEFAULT 0,
  "description_only_count" integer NOT NULL DEFAULT 0,
  "last_used_at" timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "category_learning_pkey" PRIMARY KEY ("user_id", "normalized_description", "type"),
  CONSTRAINT "category_learning_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "category_learning_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE CASCADE,
  CONSTRAINT "category_learning_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "Subcategory"("id") ON DELETE SET NULL,
  CONSTRAINT "category_learning_type_check" CHECK ("type" IN ('expense', 'income'))
);

-- Step 2: Create indexes
CREATE INDEX IF NOT EXISTS "category_learning_user_type_desc_idx"
ON "category_learning"("user_id", "type", "normalized_description");

CREATE INDEX IF NOT EXISTS "category_learning_last_used_idx"
ON "category_learning"("last_used_at" DESC);

-- Step 3: Add comments
COMMENT ON TABLE "category_learning" IS 'Aggregated category learning data for fast suggestions. Replaces scanning 12 months of transactions.';
COMMENT ON COLUMN "category_learning"."normalized_description" IS 'Normalized description (lowercase, no special chars, normalized whitespace). Must match normalizeDescription() function.';
COMMENT ON COLUMN "category_learning"."description_and_amount_count" IS 'Number of times this description+amount combination was used with this category.';
COMMENT ON COLUMN "category_learning"."description_only_count" IS 'Number of times this description (any amount) was used with this category.';
COMMENT ON COLUMN "category_learning"."last_used_at" IS 'Last time this category was used for this description. Used to prioritize recent suggestions.';

-- Step 4: Enable RLS
ALTER TABLE "category_learning" ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policy
CREATE POLICY "Users can view own category learning"
ON "category_learning"
FOR SELECT
USING ("user_id" = auth.uid());

CREATE POLICY "Users can insert own category learning"
ON "category_learning"
FOR INSERT
WITH CHECK ("user_id" = auth.uid());

CREATE POLICY "Users can update own category learning"
ON "category_learning"
FOR UPDATE
USING ("user_id" = auth.uid());

-- Note: Backfill script will populate this table with historical data
-- Note: Update function will be created in application code

