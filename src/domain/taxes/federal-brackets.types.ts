/**
 * Domain types for federal tax brackets management
 */

export interface FederalTaxBracket {
  id: string;
  countryCode: "US" | "CA";
  taxYear: number;
  bracketOrder: number;
  minIncome: number;
  maxIncome: number | null;
  taxRate: number; // Decimal rate (e.g., 0.145 for 14.5%)
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFederalBracketInput {
  countryCode: "US" | "CA";
  taxYear: number;
  bracketOrder: number;
  minIncome: number;
  maxIncome: number | null;
  taxRate: number;
  isActive?: boolean;
}

export interface UpdateFederalBracketInput {
  minIncome?: number;
  maxIncome?: number | null;
  taxRate?: number;
  isActive?: boolean;
}

