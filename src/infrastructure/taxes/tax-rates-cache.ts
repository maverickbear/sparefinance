/**
 * Tax Rates
 * Gets tax rates from database with fallback to hardcoded values
 */

import { TaxRatesRepository } from "@/src/infrastructure/database/repositories/tax-rates.repository";
import { logger } from "@/src/infrastructure/utils/logger";
import {
  US_STATE_TAX_RATES_2024,
  CANADA_PROVINCIAL_TAX_RATES_2024,
} from "./tax-brackets";

/**
 * Get US state tax rate (from database or hardcoded)
 */
export async function getUSStateTaxRate(state: string): Promise<number> {
  try {
    const repository = new TaxRatesRepository();
    const rate = await repository.findByCountryAndState("US", state.toUpperCase());
    
    if (rate && rate.isActive) {
      return rate.taxRate;
    }
  } catch (error) {
    logger.warn("[TaxRates] Error fetching tax rate from database, using hardcoded value", error);
  }

  // Fallback to hardcoded values
  return US_STATE_TAX_RATES_2024[state.toUpperCase()] || 0;
}

/**
 * Get Canadian provincial tax rate (from database or hardcoded)
 */
export async function getCanadaProvincialTaxRate(province: string): Promise<number> {
  try {
    const repository = new TaxRatesRepository();
    const rate = await repository.findByCountryAndState("CA", province.toUpperCase());
    
    if (rate && rate.isActive) {
      return rate.taxRate;
    }
  } catch (error) {
    logger.warn("[TaxRates] Error fetching tax rate from database, using hardcoded value", error);
  }

  // Fallback to hardcoded values
  return CANADA_PROVINCIAL_TAX_RATES_2024[province.toUpperCase()] || 0;
}

