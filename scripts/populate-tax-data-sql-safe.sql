-- Script SQL to populate tax brackets and tax rates
-- This script inserts all federal brackets and tax rates for US and Canada
-- Execute each INSERT statement separately if you encounter ON CONFLICT errors

-- ============================================
-- US Federal Tax Brackets 2024
-- ============================================
INSERT INTO system_tax_federal_brackets ("countryCode", "taxYear", "bracketOrder", "minIncome", "maxIncome", "taxRate", "isActive")
VALUES ('US', 2024, 1, 0, 11600, 0.10, true)
ON CONFLICT ("countryCode", "taxYear", "bracketOrder") DO NOTHING;

INSERT INTO system_tax_federal_brackets ("countryCode", "taxYear", "bracketOrder", "minIncome", "maxIncome", "taxRate", "isActive")
VALUES ('US', 2024, 2, 11600, 47150, 0.12, true)
ON CONFLICT ("countryCode", "taxYear", "bracketOrder") DO NOTHING;

INSERT INTO system_tax_federal_brackets ("countryCode", "taxYear", "bracketOrder", "minIncome", "maxIncome", "taxRate", "isActive")
VALUES ('US', 2024, 3, 47150, 100525, 0.22, true)
ON CONFLICT ("countryCode", "taxYear", "bracketOrder") DO NOTHING;

INSERT INTO system_tax_federal_brackets ("countryCode", "taxYear", "bracketOrder", "minIncome", "maxIncome", "taxRate", "isActive")
VALUES ('US', 2024, 4, 100525, 191950, 0.24, true)
ON CONFLICT ("countryCode", "taxYear", "bracketOrder") DO NOTHING;

INSERT INTO system_tax_federal_brackets ("countryCode", "taxYear", "bracketOrder", "minIncome", "maxIncome", "taxRate", "isActive")
VALUES ('US', 2024, 5, 191950, 243725, 0.32, true)
ON CONFLICT ("countryCode", "taxYear", "bracketOrder") DO NOTHING;

INSERT INTO system_tax_federal_brackets ("countryCode", "taxYear", "bracketOrder", "minIncome", "maxIncome", "taxRate", "isActive")
VALUES ('US', 2024, 6, 243725, 609350, 0.35, true)
ON CONFLICT ("countryCode", "taxYear", "bracketOrder") DO NOTHING;

INSERT INTO system_tax_federal_brackets ("countryCode", "taxYear", "bracketOrder", "minIncome", "maxIncome", "taxRate", "isActive")
VALUES ('US', 2024, 7, 609350, NULL, 0.37, true)
ON CONFLICT ("countryCode", "taxYear", "bracketOrder") DO NOTHING;

-- ============================================
-- Canada Federal Tax Brackets 2024
-- ============================================
INSERT INTO system_tax_federal_brackets ("countryCode", "taxYear", "bracketOrder", "minIncome", "maxIncome", "taxRate", "isActive")
VALUES ('CA', 2024, 1, 0, 55867, 0.15, true)
ON CONFLICT ("countryCode", "taxYear", "bracketOrder") DO NOTHING;

INSERT INTO system_tax_federal_brackets ("countryCode", "taxYear", "bracketOrder", "minIncome", "maxIncome", "taxRate", "isActive")
VALUES ('CA', 2024, 2, 55867, 111733, 0.205, true)
ON CONFLICT ("countryCode", "taxYear", "bracketOrder") DO NOTHING;

INSERT INTO system_tax_federal_brackets ("countryCode", "taxYear", "bracketOrder", "minIncome", "maxIncome", "taxRate", "isActive")
VALUES ('CA', 2024, 3, 111733, 173205, 0.26, true)
ON CONFLICT ("countryCode", "taxYear", "bracketOrder") DO NOTHING;

INSERT INTO system_tax_federal_brackets ("countryCode", "taxYear", "bracketOrder", "minIncome", "maxIncome", "taxRate", "isActive")
VALUES ('CA', 2024, 4, 173205, 246752, 0.29, true)
ON CONFLICT ("countryCode", "taxYear", "bracketOrder") DO NOTHING;

INSERT INTO system_tax_federal_brackets ("countryCode", "taxYear", "bracketOrder", "minIncome", "maxIncome", "taxRate", "isActive")
VALUES ('CA', 2024, 5, 246752, NULL, 0.33, true)
ON CONFLICT ("countryCode", "taxYear", "bracketOrder") DO NOTHING;

-- ============================================
-- Canada Federal Tax Brackets 2025
-- ============================================
INSERT INTO system_tax_federal_brackets ("countryCode", "taxYear", "bracketOrder", "minIncome", "maxIncome", "taxRate", "isActive")
VALUES ('CA', 2025, 1, 0, 57375, 0.145, true)
ON CONFLICT ("countryCode", "taxYear", "bracketOrder") DO NOTHING;

INSERT INTO system_tax_federal_brackets ("countryCode", "taxYear", "bracketOrder", "minIncome", "maxIncome", "taxRate", "isActive")
VALUES ('CA', 2025, 2, 57375, 114750, 0.205, true)
ON CONFLICT ("countryCode", "taxYear", "bracketOrder") DO NOTHING;

INSERT INTO system_tax_federal_brackets ("countryCode", "taxYear", "bracketOrder", "minIncome", "maxIncome", "taxRate", "isActive")
VALUES ('CA', 2025, 3, 114750, 177882, 0.26, true)
ON CONFLICT ("countryCode", "taxYear", "bracketOrder") DO NOTHING;

INSERT INTO system_tax_federal_brackets ("countryCode", "taxYear", "bracketOrder", "minIncome", "maxIncome", "taxRate", "isActive")
VALUES ('CA', 2025, 4, 177882, 253414, 0.29, true)
ON CONFLICT ("countryCode", "taxYear", "bracketOrder") DO NOTHING;

INSERT INTO system_tax_federal_brackets ("countryCode", "taxYear", "bracketOrder", "minIncome", "maxIncome", "taxRate", "isActive")
VALUES ('CA', 2025, 5, 253414, NULL, 0.33, true)
ON CONFLICT ("countryCode", "taxYear", "bracketOrder") DO NOTHING;

-- ============================================
-- US State Tax Rates (execute in batches if needed)
-- ============================================
INSERT INTO system_tax_rates ("countryCode", "stateOrProvinceCode", "taxRate", "displayName", "description", "isActive")
VALUES
  ('US', 'AL', 0.05, 'Alabama', 'Effective state income tax rate for Alabama', true),
  ('US', 'AK', 0.00, 'Alaska', 'No state income tax', true),
  ('US', 'AZ', 0.025, 'Arizona', 'Effective state income tax rate for Arizona', true),
  ('US', 'AR', 0.055, 'Arkansas', 'Effective state income tax rate for Arkansas', true),
  ('US', 'CA', 0.133, 'California', 'Effective state income tax rate for California', true),
  ('US', 'CO', 0.044, 'Colorado', 'Effective state income tax rate for Colorado', true),
  ('US', 'CT', 0.06, 'Connecticut', 'Effective state income tax rate for Connecticut', true),
  ('US', 'DE', 0.066, 'Delaware', 'Effective state income tax rate for Delaware', true),
  ('US', 'FL', 0.00, 'Florida', 'No state income tax', true),
  ('US', 'GA', 0.0575, 'Georgia', 'Effective state income tax rate for Georgia', true),
  ('US', 'HI', 0.11, 'Hawaii', 'Effective state income tax rate for Hawaii', true),
  ('US', 'ID', 0.06, 'Idaho', 'Effective state income tax rate for Idaho', true),
  ('US', 'IL', 0.0495, 'Illinois', 'Effective state income tax rate for Illinois', true),
  ('US', 'IN', 0.0323, 'Indiana', 'Effective state income tax rate for Indiana', true),
  ('US', 'IA', 0.06, 'Iowa', 'Effective state income tax rate for Iowa', true),
  ('US', 'KS', 0.057, 'Kansas', 'Effective state income tax rate for Kansas', true),
  ('US', 'KY', 0.05, 'Kentucky', 'Effective state income tax rate for Kentucky', true)
ON CONFLICT ("countryCode", "stateOrProvinceCode") DO NOTHING;

INSERT INTO system_tax_rates ("countryCode", "stateOrProvinceCode", "taxRate", "displayName", "description", "isActive")
VALUES
  ('US', 'LA', 0.06, 'Louisiana', 'Effective state income tax rate for Louisiana', true),
  ('US', 'ME', 0.075, 'Maine', 'Effective state income tax rate for Maine', true),
  ('US', 'MD', 0.0575, 'Maryland', 'Effective state income tax rate for Maryland', true),
  ('US', 'MA', 0.05, 'Massachusetts', 'Effective state income tax rate for Massachusetts', true),
  ('US', 'MI', 0.0425, 'Michigan', 'Effective state income tax rate for Michigan', true),
  ('US', 'MN', 0.095, 'Minnesota', 'Effective state income tax rate for Minnesota', true),
  ('US', 'MS', 0.05, 'Mississippi', 'Effective state income tax rate for Mississippi', true),
  ('US', 'MO', 0.054, 'Missouri', 'Effective state income tax rate for Missouri', true),
  ('US', 'MT', 0.0675, 'Montana', 'Effective state income tax rate for Montana', true),
  ('US', 'NE', 0.0684, 'Nebraska', 'Effective state income tax rate for Nebraska', true),
  ('US', 'NV', 0.00, 'Nevada', 'No state income tax', true),
  ('US', 'NH', 0.00, 'New Hampshire', 'No state income tax (only on interest/dividends)', true),
  ('US', 'NJ', 0.106, 'New Jersey', 'Effective state income tax rate for New Jersey', true),
  ('US', 'NM', 0.059, 'New Mexico', 'Effective state income tax rate for New Mexico', true),
  ('US', 'NY', 0.109, 'New York', 'Effective state income tax rate for New York', true),
  ('US', 'NC', 0.0525, 'North Carolina', 'Effective state income tax rate for North Carolina', true),
  ('US', 'ND', 0.029, 'North Dakota', 'Effective state income tax rate for North Dakota', true)
ON CONFLICT ("countryCode", "stateOrProvinceCode") DO NOTHING;

INSERT INTO system_tax_rates ("countryCode", "stateOrProvinceCode", "taxRate", "displayName", "description", "isActive")
VALUES
  ('US', 'OH', 0.0399, 'Ohio', 'Effective state income tax rate for Ohio', true),
  ('US', 'OK', 0.05, 'Oklahoma', 'Effective state income tax rate for Oklahoma', true),
  ('US', 'OR', 0.099, 'Oregon', 'Effective state income tax rate for Oregon', true),
  ('US', 'PA', 0.0307, 'Pennsylvania', 'Effective state income tax rate for Pennsylvania', true),
  ('US', 'RI', 0.0599, 'Rhode Island', 'Effective state income tax rate for Rhode Island', true),
  ('US', 'SC', 0.07, 'South Carolina', 'Effective state income tax rate for South Carolina', true),
  ('US', 'SD', 0.00, 'South Dakota', 'No state income tax', true),
  ('US', 'TN', 0.00, 'Tennessee', 'No state income tax', true),
  ('US', 'TX', 0.00, 'Texas', 'No state income tax', true),
  ('US', 'UT', 0.0485, 'Utah', 'Effective state income tax rate for Utah', true),
  ('US', 'VT', 0.0875, 'Vermont', 'Effective state income tax rate for Vermont', true),
  ('US', 'VA', 0.0575, 'Virginia', 'Effective state income tax rate for Virginia', true),
  ('US', 'WA', 0.00, 'Washington', 'No state income tax', true),
  ('US', 'WV', 0.065, 'West Virginia', 'Effective state income tax rate for West Virginia', true),
  ('US', 'WI', 0.0765, 'Wisconsin', 'Effective state income tax rate for Wisconsin', true),
  ('US', 'WY', 0.00, 'Wyoming', 'No state income tax', true),
  ('US', 'DC', 0.1075, 'District of Columbia', 'Effective state income tax rate for District of Columbia', true)
ON CONFLICT ("countryCode", "stateOrProvinceCode") DO NOTHING;

-- ============================================
-- Canadian Provincial Tax Rates
-- ============================================
INSERT INTO system_tax_rates ("countryCode", "stateOrProvinceCode", "taxRate", "displayName", "description", "isActive")
VALUES
  ('CA', 'AB', 0.10, 'Alberta', 'Effective provincial income tax rate for Alberta', true),
  ('CA', 'BC', 0.1205, 'British Columbia', 'Effective provincial income tax rate for British Columbia', true),
  ('CA', 'MB', 0.1275, 'Manitoba', 'Effective provincial income tax rate for Manitoba', true),
  ('CA', 'NB', 0.1394, 'New Brunswick', 'Effective provincial income tax rate for New Brunswick', true),
  ('CA', 'NL', 0.1287, 'Newfoundland and Labrador', 'Effective provincial income tax rate for Newfoundland and Labrador', true),
  ('CA', 'NS', 0.1479, 'Nova Scotia', 'Effective provincial income tax rate for Nova Scotia', true),
  ('CA', 'NT', 0.059, 'Northwest Territories', 'Effective provincial income tax rate for Northwest Territories', true),
  ('CA', 'NU', 0.04, 'Nunavut', 'Effective provincial income tax rate for Nunavut', true),
  ('CA', 'ON', 0.0933, 'Ontario', 'Effective provincial income tax rate for Ontario', true),
  ('CA', 'PE', 0.098, 'Prince Edward Island', 'Effective provincial income tax rate for Prince Edward Island', true),
  ('CA', 'QC', 0.14, 'Quebec', 'Effective provincial income tax rate for Quebec', true),
  ('CA', 'SK', 0.105, 'Saskatchewan', 'Effective provincial income tax rate for Saskatchewan', true),
  ('CA', 'YT', 0.064, 'Yukon', 'Effective provincial income tax rate for Yukon', true)
ON CONFLICT ("countryCode", "stateOrProvinceCode") DO NOTHING;
