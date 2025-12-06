/**
 * Tax Brackets for US and Canada
 * 2024 tax year brackets
 * Rates are stored as decimals (e.g., 0.22 for 22%)
 */

import { TaxBracket } from "@/src/domain/taxes/taxes.types";

// US Federal Tax Brackets 2024 (Single filer)
export const US_FEDERAL_BRACKETS_2024: TaxBracket[] = [
  { min: 0, max: 11600, rate: 0.10 },
  { min: 11600, max: 47150, rate: 0.12 },
  { min: 47150, max: 100525, rate: 0.22 },
  { min: 100525, max: 191950, rate: 0.24 },
  { min: 191950, max: 243725, rate: 0.32 },
  { min: 243725, max: 609350, rate: 0.35 },
  { min: 609350, max: null, rate: 0.37 },
];

// US State Tax Brackets 2024 (simplified - using flat rates for most states)
// Note: Some states have progressive brackets, but we'll use effective rates for simplicity
// These are approximate effective rates based on average income
export const US_STATE_TAX_RATES_2024: Record<string, number> = {
  AL: 0.05, // Alabama - 2% to 5%
  AK: 0.00, // Alaska - no state income tax
  AZ: 0.025, // Arizona - 2.5% flat
  AR: 0.055, // Arkansas - 2% to 5.5%
  CA: 0.133, // California - 1% to 13.3% (using effective rate ~9-13% for middle income)
  CO: 0.044, // Colorado - 4.4% flat
  CT: 0.06, // Connecticut - 3% to 6.99%
  DE: 0.066, // Delaware - 2.2% to 6.6%
  FL: 0.00, // Florida - no state income tax
  GA: 0.0575, // Georgia - 1% to 5.75%
  HI: 0.11, // Hawaii - 1.4% to 11%
  ID: 0.06, // Idaho - 1% to 6%
  IL: 0.0495, // Illinois - 4.95% flat
  IN: 0.0323, // Indiana - 3.23% flat
  IA: 0.06, // Iowa - 0.33% to 8.53% (using effective ~6%)
  KS: 0.057, // Kansas - 3.1% to 5.7%
  KY: 0.05, // Kentucky - 5% flat
  LA: 0.06, // Louisiana - 2% to 6%
  ME: 0.075, // Maine - 5.8% to 7.15%
  MD: 0.0575, // Maryland - 2% to 5.75%
  MA: 0.05, // Massachusetts - 5% flat
  MI: 0.0425, // Michigan - 4.25% flat
  MN: 0.095, // Minnesota - 5.35% to 9.85%
  MS: 0.05, // Mississippi - 3% to 5%
  MO: 0.054, // Missouri - 1.5% to 5.4%
  MT: 0.0675, // Montana - 1% to 6.75%
  NE: 0.0684, // Nebraska - 2.46% to 6.84%
  NV: 0.00, // Nevada - no state income tax
  NH: 0.00, // New Hampshire - no state income tax (only on interest/dividends)
  NJ: 0.106, // New Jersey - 1.4% to 10.75%
  NM: 0.059, // New Mexico - 1.7% to 5.9%
  NY: 0.109, // New York - 4% to 10.9%
  NC: 0.0525, // North Carolina - 4.75% flat (2024)
  ND: 0.029, // North Dakota - 1.1% to 2.9%
  OH: 0.0399, // Ohio - 2.765% to 3.99%
  OK: 0.05, // Oklahoma - 0.25% to 5%
  OR: 0.099, // Oregon - 4.75% to 9.9%
  PA: 0.0307, // Pennsylvania - 3.07% flat
  RI: 0.0599, // Rhode Island - 3.75% to 5.99%
  SC: 0.07, // South Carolina - 0% to 7%
  SD: 0.00, // South Dakota - no state income tax
  TN: 0.00, // Tennessee - no state income tax
  TX: 0.00, // Texas - no state income tax
  UT: 0.0485, // Utah - 4.85% flat
  VT: 0.0875, // Vermont - 3.35% to 8.75%
  VA: 0.0575, // Virginia - 2% to 5.75%
  WA: 0.00, // Washington - no state income tax
  WV: 0.065, // West Virginia - 3% to 6.5%
  WI: 0.0765, // Wisconsin - 3.54% to 7.65%
  WY: 0.00, // Wyoming - no state income tax
  DC: 0.1075, // District of Columbia - 4% to 10.75%
};

// Canada Federal Tax Brackets 2025
// Source: https://www.canada.ca/en/revenue-agency/services/tax/individuals/frequently-asked-questions-individuals/canadian-income-tax-rates-individuals-current-previous-years.html
// Note: 14.5% reflects the reduction from 15% to 14% effective July 1, 2025, resulting in an average of 14.5% for the year
export const CANADA_FEDERAL_BRACKETS_2025: TaxBracket[] = [
  { min: 0, max: 57375, rate: 0.145 }, // 14.5% on taxable income up to $57,375
  { min: 57375, max: 114750, rate: 0.205 }, // 20.5% on taxable income over $57,375 up to $114,750
  { min: 114750, max: 177882, rate: 0.26 }, // 26% on taxable income over $114,750 up to $177,882
  { min: 177882, max: 253414, rate: 0.29 }, // 29% on taxable income over $177,882 up to $253,414
  { min: 253414, max: null, rate: 0.33 }, // 33% on taxable income over $253,414
];

// Canada Federal Tax Brackets 2024 (kept for backward compatibility)
export const CANADA_FEDERAL_BRACKETS_2024: TaxBracket[] = [
  { min: 0, max: 55867, rate: 0.15 }, // 15% on taxable income up to $55,867
  { min: 55867, max: 111733, rate: 0.205 }, // 20.5% on taxable income over $55,867 up to $111,733
  { min: 111733, max: 173205, rate: 0.26 }, // 26% on taxable income over $111,733 up to $173,205
  { min: 173205, max: 246752, rate: 0.29 }, // 29% on taxable income over $173,205 up to $246,752
  { min: 246752, max: null, rate: 0.33 }, // 33% on taxable income over $246,752
];

// Canadian Provincial/Territorial Tax Rates 2024
// Source: https://www.canada.ca/en/revenue-agency/services/tax/individuals/frequently-asked-questions-individuals/canadian-income-tax-rates-individuals-current-previous-years.html
// Note: Using effective/average rates for middle-income earners as provinces have progressive brackets
// These rates represent approximate effective rates for typical income levels
export const CANADA_PROVINCIAL_TAX_RATES_2024: Record<string, number> = {
  AB: 0.10, // Alberta - 10% flat rate
  BC: 0.1205, // British Columbia - 5.06% to 20.5% (effective ~12.05% for middle income)
  MB: 0.1275, // Manitoba - 10.8% to 17% (effective ~12.75% for middle income)
  NB: 0.1394, // New Brunswick - 9.4% to 20.3% (effective ~13.94% for middle income)
  NL: 0.1287, // Newfoundland and Labrador - 8.7% to 18.3% (effective ~12.87% for middle income)
  NS: 0.1479, // Nova Scotia - 8.79% to 21% (effective ~14.79% for middle income)
  NT: 0.059, // Northwest Territories - 5.9% to 11.7% (effective ~5.9% for lower brackets, ~8.6% average)
  NU: 0.04, // Nunavut - 4% to 11.5% (effective ~4% for lower brackets, ~7.75% average)
  ON: 0.0933, // Ontario - 5.05% to 13.16% (effective ~9.33% for middle income)
  PE: 0.098, // Prince Edward Island - 9.8% to 18% (effective ~9.8% for lower brackets, ~13.9% average)
  QC: 0.14, // Quebec - 14% to 25.75% (effective ~14% for lower brackets, ~19.875% average) - Note: Quebec has different tax system
  SK: 0.105, // Saskatchewan - 10.5% to 15% (effective ~10.5% for lower brackets, ~12.75% average)
  YT: 0.064, // Yukon - 6.4% to 15% (effective ~6.4% for lower brackets, ~10.7% average)
};

/**
 * Get US federal tax brackets
 */
export function getUSFederalBrackets(): TaxBracket[] {
  return US_FEDERAL_BRACKETS_2024;
}

/**
 * Get US state tax rate for a given state
 */
export function getUSStateTaxRate(state: string): number {
  return US_STATE_TAX_RATES_2024[state.toUpperCase()] || 0;
}

/**
 * Get Canada federal tax brackets
 * Returns 2025 brackets by default
 */
export function getCanadaFederalBrackets(): TaxBracket[] {
  return CANADA_FEDERAL_BRACKETS_2025;
}

/**
 * Get Canadian provincial tax rate for a given province
 */
export function getCanadaProvincialTaxRate(province: string): number {
  return CANADA_PROVINCIAL_TAX_RATES_2024[province.toUpperCase()] || 0;
}

