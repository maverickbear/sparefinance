/**
 * Tax Calculator
 * Infrastructure layer - performs tax calculations using tax brackets
 * No business logic here, just calculation algorithms
 */

import { TaxBracket, TaxCalculationResult } from "@/src/domain/taxes/taxes.types";
import {
  getUSFederalBrackets,
  getUSStateTaxRate,
  getCanadaFederalBrackets,
  getCanadaProvincialTaxRate,
} from "./tax-brackets";

/**
 * Calculate tax using progressive brackets
 */
function calculateProgressiveTax(income: number, brackets: TaxBracket[]): number {
  let totalTax = 0;
  let remainingIncome = income;

  for (const bracket of brackets) {
    if (remainingIncome <= 0) break;

    const bracketMin = bracket.min;
    const bracketMax = bracket.max ?? Infinity;
    const bracketRate = bracket.rate;

    // Calculate taxable amount in this bracket
    const taxableInBracket = Math.min(
      remainingIncome,
      bracketMax - bracketMin
    );

    if (taxableInBracket > 0) {
      totalTax += taxableInBracket * bracketRate;
      remainingIncome -= taxableInBracket;
    }
  }

  return Math.round(totalTax * 100) / 100; // Round to 2 decimals
}

/**
 * Calculate US taxes (federal + state)
 */
export function calculateUSTaxes(
  annualIncome: number,
  state?: string | null
): TaxCalculationResult {
  // Calculate federal tax
  const federalBrackets = getUSFederalBrackets();
  const federalTax = calculateProgressiveTax(annualIncome, federalBrackets);

  // Calculate state tax (flat rate for simplicity)
  const stateRate = state ? getUSStateTaxRate(state) : 0;
  const stateTax = stateRate > 0 ? Math.round(annualIncome * stateRate * 100) / 100 : 0;

  // Calculate total tax
  const totalTax = federalTax + stateTax;

  // Calculate effective rate
  const effectiveTaxRate = annualIncome > 0 ? totalTax / annualIncome : 0;

  // Calculate after-tax income
  const afterTaxIncome = annualIncome - totalTax;

  return {
    effectiveTaxRate: Math.round(effectiveTaxRate * 10000) / 10000, // Round to 4 decimals
    totalTax: Math.round(totalTax * 100) / 100,
    afterTaxIncome: Math.round(afterTaxIncome * 100) / 100,
    federalTax: Math.round(federalTax * 100) / 100,
    stateOrProvincialTax: Math.round(stateTax * 100) / 100,
  };
}

/**
 * Calculate Canada taxes (federal + provincial)
 */
export function calculateCanadaTaxes(
  annualIncome: number,
  province?: string | null
): TaxCalculationResult {
  // Calculate federal tax
  const federalBrackets = getCanadaFederalBrackets();
  const federalTax = calculateProgressiveTax(annualIncome, federalBrackets);

  // Calculate provincial tax (flat rate for simplicity)
  const provincialRate = province ? getCanadaProvincialTaxRate(province) : 0;
  const provincialTax = provincialRate > 0 ? Math.round(annualIncome * provincialRate * 100) / 100 : 0;

  // Calculate total tax
  const totalTax = federalTax + provincialTax;

  // Calculate effective rate
  const effectiveTaxRate = annualIncome > 0 ? totalTax / annualIncome : 0;

  // Calculate after-tax income
  const afterTaxIncome = annualIncome - totalTax;

  return {
    effectiveTaxRate: Math.round(effectiveTaxRate * 10000) / 10000, // Round to 4 decimals
    totalTax: Math.round(totalTax * 100) / 100,
    afterTaxIncome: Math.round(afterTaxIncome * 100) / 100,
    federalTax: Math.round(federalTax * 100) / 100,
    stateOrProvincialTax: Math.round(provincialTax * 100) / 100,
  };
}

/**
 * Calculate taxes based on country
 */
export function calculateTaxes(
  country: string,
  annualIncome: number,
  stateOrProvince?: string | null
): TaxCalculationResult {
  if (country === "US") {
    return calculateUSTaxes(annualIncome, stateOrProvince || undefined);
  } else if (country === "CA") {
    return calculateCanadaTaxes(annualIncome, stateOrProvince || undefined);
  } else {
    // Unknown country - return zero taxes
    return {
      effectiveTaxRate: 0,
      totalTax: 0,
      afterTaxIncome: annualIncome,
      federalTax: 0,
      stateOrProvincialTax: 0,
    };
  }
}

