/**
 * Federal Tax Brackets Service
 * Business logic for federal tax brackets management
 */

import { FederalBracketsRepository } from "@/src/infrastructure/database/repositories/federal-brackets.repository";
import {
  FederalTaxBracket,
  CreateFederalBracketInput,
  UpdateFederalBracketInput,
} from "@/src/domain/taxes/federal-brackets.types";
import {
  createFederalBracketSchema,
  updateFederalBracketSchema,
} from "@/src/domain/taxes/federal-brackets.validations";
import { AppError } from "../shared/app-error";
import { logger } from "@/src/infrastructure/utils/logger";

export class FederalBracketsService {
  constructor(private repository: FederalBracketsRepository) {}

  /**
   * Get all federal brackets
   */
  async getAll(): Promise<FederalTaxBracket[]> {
    try {
      return await this.repository.findAll();
    } catch (error) {
      logger.error("[FederalBracketsService] Error fetching brackets:", error);
      throw new AppError(
        error instanceof Error ? error.message : "Failed to fetch federal brackets",
        500
      );
    }
  }

  /**
   * Get brackets by country and year
   */
  async getByCountryAndYear(
    countryCode: string,
    taxYear: number
  ): Promise<FederalTaxBracket[]> {
    try {
      return await this.repository.findByCountryAndYear(countryCode, taxYear);
    } catch (error) {
      logger.error("[FederalBracketsService] Error fetching brackets:", error);
      throw new AppError(
        error instanceof Error ? error.message : "Failed to fetch federal brackets",
        500
      );
    }
  }

  /**
   * Get bracket by ID
   */
  async getById(id: string): Promise<FederalTaxBracket> {
    const bracket = await this.repository.findById(id);

    if (!bracket) {
      throw new AppError("Federal bracket not found", 404);
    }

    return bracket;
  }

  /**
   * Create a new bracket
   */
  async create(input: unknown): Promise<FederalTaxBracket> {
    const validated = createFederalBracketSchema.parse(input);

    try {
      return await this.repository.create(validated);
    } catch (error) {
      logger.error("[FederalBracketsService] Error creating bracket:", error);
      throw new AppError(
        error instanceof Error ? error.message : "Failed to create federal bracket",
        500
      );
    }
  }

  /**
   * Update a bracket
   */
  async update(id: string, input: unknown): Promise<FederalTaxBracket> {
    const validated = updateFederalBracketSchema.parse(input);

    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AppError("Federal bracket not found", 404);
    }

    try {
      return await this.repository.update(id, validated);
    } catch (error) {
      logger.error("[FederalBracketsService] Error updating bracket:", error);
      throw new AppError(
        error instanceof Error ? error.message : "Failed to update federal bracket",
        500
      );
    }
  }

  /**
   * Delete a bracket
   */
  async delete(id: string): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AppError("Federal bracket not found", 404);
    }

    try {
      await this.repository.delete(id);
    } catch (error) {
      logger.error("[FederalBracketsService] Error deleting bracket:", error);
      throw new AppError(
        error instanceof Error ? error.message : "Failed to delete federal bracket",
        500
      );
    }
  }
}

