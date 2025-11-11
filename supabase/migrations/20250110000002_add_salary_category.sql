-- Migration: Add Salary category to Income macro (system category)
-- This migration creates the Salary category within the Income macro
-- with userId = NULL (system category shared by all users)

DO $$
DECLARE
  macro_income_id TEXT;
BEGIN
  -- Get the Income macro ID (system macro with userId = NULL)
  SELECT id INTO macro_income_id 
  FROM "Macro" 
  WHERE name = 'Income' AND "userId" IS NULL 
  LIMIT 1;

  -- Only proceed if Income macro exists
  IF macro_income_id IS NOT NULL THEN
    -- Insert Salary category only if it doesn't already exist
    INSERT INTO "Category" (id, name, "macroId", "userId", "createdAt", "updatedAt")
    SELECT 
      gen_random_uuid()::text,
      'Salary',
      macro_income_id,
      NULL,
      NOW(),
      NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM "Category" 
      WHERE name = 'Salary' 
      AND "macroId" = macro_income_id 
      AND "userId" IS NULL
    );
  END IF;
END $$;

