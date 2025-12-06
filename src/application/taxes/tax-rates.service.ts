/**
 * Tax Rates Service
 * Business logic for tax rates management
 */

import { TaxRatesRepository } from "@/src/infrastructure/database/repositories/tax-rates.repository";
import {
  TaxRate,
  CreateTaxRateInput,
  UpdateTaxRateInput,
} from "@/src/domain/taxes/tax-rates.types";
import {
  createTaxRateSchema,
  updateTaxRateSchema,
} from "@/src/domain/taxes/tax-rates.validations";
import { AppError } from "../shared/app-error";
import { logger } from "@/src/infrastructure/utils/logger";
import { cacheLife, cacheTag } from 'next/cache';

// Cached helper function (must be standalone, not class method)
// Cannot accept class instances as parameters - must create repository inside
async function getAllTaxRatesCached(): Promise<TaxRate[]> {
  'use cache'
  cacheTag('tax-rates')
  cacheLife('days') // Changes annually
  
  try {
    // Create repository inside cached function (cannot pass instances as parameters)
    const repository = new TaxRatesRepository();
    return await repository.findAll();
  } catch (error) {
    logger.error("[TaxRatesService] Error fetching tax rates:", error);
    throw new AppError(
      error instanceof Error ? error.message : "Failed to fetch tax rates",
      500
    );
  }
}

export class TaxRatesService {
  constructor(private repository: TaxRatesRepository) {}

  /**
   * Get all tax rates
   */
  async getAll(): Promise<TaxRate[]> {
    return getAllTaxRatesCached();
  }

  /**
   * Get tax rate by ID
   */
  async getById(id: string): Promise<TaxRate> {
    const rate = await this.repository.findById(id);

    if (!rate) {
      throw new AppError("Tax rate not found", 404);
    }

    return rate;
  }

  /**
   * Get tax rate by country and state/province
   */
  async getByCountryAndState(
    countryCode: string,
    stateOrProvinceCode: string
  ): Promise<TaxRate | null> {
    return await this.repository.findByCountryAndState(
      countryCode,
      stateOrProvinceCode
    );
  }

  /**
   * Create a new tax rate
   */
  async create(input: unknown): Promise<TaxRate> {
    // Validate input
    const validated = createTaxRateSchema.parse(input);

    // Check if tax rate already exists
    const existing = await this.repository.findByCountryAndState(
      validated.countryCode,
      validated.stateOrProvinceCode
    );

    if (existing) {
      throw new AppError(
        `Tax rate for ${validated.countryCode}-${validated.stateOrProvinceCode} already exists`,
        409
      );
    }

    try {
      return await this.repository.create(validated);
    } catch (error) {
      logger.error("[TaxRatesService] Error creating tax rate:", error);
      throw new AppError(
        error instanceof Error ? error.message : "Failed to create tax rate",
        500
      );
    }
  }

  /**
   * Update a tax rate
   */
  async update(id: string, input: unknown): Promise<TaxRate> {
    // Validate input
    const validated = updateTaxRateSchema.parse(input);

    // Check if tax rate exists
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AppError("Tax rate not found", 404);
    }

    try {
      return await this.repository.update(id, validated);
    } catch (error) {
      logger.error("[TaxRatesService] Error updating tax rate:", error);
      throw new AppError(
        error instanceof Error ? error.message : "Failed to update tax rate",
        500
      );
    }
  }

  /**
   * Delete a tax rate
   */
  async delete(id: string): Promise<void> {
    // Check if tax rate exists
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AppError("Tax rate not found", 404);
    }

    try {
      await this.repository.delete(id);
    } catch (error) {
      logger.error("[TaxRatesService] Error deleting tax rate:", error);
      throw new AppError(
        error instanceof Error ? error.message : "Failed to delete tax rate",
        500
      );
    }
  }
}

