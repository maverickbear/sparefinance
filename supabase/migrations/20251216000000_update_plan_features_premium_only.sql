-- Update plan features: Investments and Household Members are now Premium-only
-- Basic plan: remove hasInvestments, add hasHousehold: false
-- Premium plan: keep hasInvestments: true, add hasHousehold: true

-- Update Basic plan
UPDATE "Plan"
SET 
  "features" = jsonb_set(
    jsonb_set(
      "features",
      '{hasInvestments}',
      'false'::jsonb
    ),
    '{hasHousehold}',
    'false'::jsonb
  ),
  "updatedAt" = NOW()
WHERE "id" = 'basic';

-- Update Premium plan
UPDATE "Plan"
SET 
  "features" = jsonb_set(
    "features",
    '{hasHousehold}',
    'true'::jsonb
  ),
  "updatedAt" = NOW()
WHERE "id" = 'premium';

