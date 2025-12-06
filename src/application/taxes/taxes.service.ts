/**
 * Taxes Service
 * Business logic for tax calculations
 */

import { TaxCalculationInput, TaxCalculationResult } from "@/src/domain/taxes/taxes.types";
import { taxCalculationInputSchema } from "@/src/domain/taxes/taxes.validations";
import { calculateTaxes } from "@/src/infrastructure/taxes/tax-calculator";
import { AppError } from "../shared/app-error";
import { logger } from "@/src/infrastructure/utils/logger";

export class TaxesService {
  /**
   * Calculate taxes based on location and income
   */
  async calculateTaxes(input: unknown): Promise<TaxCalculationResult> {
    // Validate input
    const validated = taxCalculationInputSchema.parse(input);

    // Validate state/province is provided when required
    if (validated.country === "US" && !validated.stateOrProvince) {
      throw new AppError("State is required for US tax calculations", 400);
    }

    if (validated.country === "CA" && !validated.stateOrProvince) {
      throw new AppError("Province is required for Canadian tax calculations", 400);
    }

    // Perform calculation
    try {
      const result = await calculateTaxes(
        validated.country,
        validated.annualIncome,
        validated.stateOrProvince || undefined
      );

      logger.debug("[TaxesService] Tax calculation completed", {
        country: validated.country,
        stateOrProvince: validated.stateOrProvince,
        annualIncome: validated.annualIncome,
        effectiveTaxRate: result.effectiveTaxRate,
        totalTax: result.totalTax,
      });

      return result;
    } catch (error) {
      logger.error("[TaxesService] Error calculating taxes:", error);
      throw new AppError(
        error instanceof Error ? error.message : "Failed to calculate taxes",
        500
      );
    }
  }

  /**
   * Calculate after-tax income from gross income
   */
  async calculateAfterTaxIncome(
    country: string,
    annualIncome: number,
    stateOrProvince?: string | null
  ): Promise<number> {
    const result = await this.calculateTaxes({
      country,
      stateOrProvince,
      annualIncome,
    });

    return result.afterTaxIncome;
  }

  /**
   * Calculate monthly after-tax income from annual gross income
   */
  async calculateMonthlyAfterTaxIncome(
    country: string,
    annualIncome: number,
    stateOrProvince?: string | null
  ): Promise<number> {
    const annualAfterTax = await this.calculateAfterTaxIncome(
      country,
      annualIncome,
      stateOrProvince
    );

    return Math.round((annualAfterTax / 12) * 100) / 100;
  }
}

