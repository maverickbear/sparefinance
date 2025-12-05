/**
 * Domain types for tax calculations
 * Pure TypeScript types with no external dependencies
 */

export interface TaxBracket {
  min: number;
  max: number | null; // null means no upper limit
  rate: number; // Rate as decimal (e.g., 0.22 for 22%)
}

export interface TaxCalculationInput {
  country: string; // ISO 3166-1 alpha-2 country code (e.g., "US", "CA")
  stateOrProvince?: string | null; // State/province code (e.g., "CA", "ON")
  annualIncome: number; // Annual gross income
}

export interface TaxCalculationResult {
  effectiveTaxRate: number; // Effective tax rate as decimal (e.g., 0.25 for 25%)
  totalTax: number; // Total tax amount
  afterTaxIncome: number; // Annual income after taxes
  federalTax: number; // Federal tax amount
  stateOrProvincialTax: number; // State/provincial tax amount
}

