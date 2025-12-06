/**
 * Domain types for tax rates management
 * Used for managing state/province tax rates in the portal
 */

export interface TaxRate {
  id: string;
  countryCode: "US" | "CA";
  stateOrProvinceCode: string;
  taxRate: number; // Decimal rate (e.g., 0.05 for 5%)
  displayName: string;
  description?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTaxRateInput {
  countryCode: "US" | "CA";
  stateOrProvinceCode: string;
  taxRate: number;
  displayName: string;
  description?: string | null;
  isActive?: boolean;
}

export interface UpdateTaxRateInput {
  taxRate?: number;
  displayName?: string;
  description?: string | null;
  isActive?: boolean;
}

