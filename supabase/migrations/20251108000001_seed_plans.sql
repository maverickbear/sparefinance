-- Insert default plans (Basic and Premium only - no Free plan)
-- Note: hasInvestments and hasHousehold are Premium-only features
INSERT INTO "Plan" ("id", "name", "priceMonthly", "priceYearly", "features", "createdAt", "updatedAt")
VALUES
  (
    'basic',
    'basic',
    7.99,
    79.90,
    '{"maxTransactions": 300, "maxAccounts": 8, "hasInvestments": false, "hasAdvancedReports": true, "hasCsvExport": true, "hasDebts": true, "hasGoals": true, "hasHousehold": false}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'premium',
    'premium',
    14.99,
    149.90,
    '{"maxTransactions": -1, "maxAccounts": -1, "hasInvestments": true, "hasAdvancedReports": true, "hasCsvExport": true, "hasDebts": true, "hasGoals": true, "hasHousehold": true}'::jsonb,
    NOW(),
    NOW()
  )
ON CONFLICT ("id") DO NOTHING;

