/**
 * Federal Tax Brackets Repository
 * Data access layer for federal tax brackets
 */

import { createServiceRoleClient } from "../supabase-server";
import { FederalTaxBracket } from "@/src/domain/taxes/federal-brackets.types";
import { logger } from "@/src/infrastructure/utils/logger";

export interface FederalBracketRow {
  id: string;
  countryCode: string;
  taxYear: number;
  bracketOrder: number;
  minIncome: number;
  maxIncome: number | null;
  taxRate: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export class FederalBracketsRepository {
  /**
   * Find all federal brackets for a country and year
   */
  async findByCountryAndYear(
    countryCode: string,
    taxYear: number
  ): Promise<FederalTaxBracket[]> {
    const supabase = createServiceRoleClient();

    const { data: brackets, error } = await supabase
      .from("system_tax_federal_brackets")
      .select("*")
      .eq("countryCode", countryCode)
      .eq("taxYear", taxYear)
      .eq("isActive", true)
      .order("bracketOrder", { ascending: true });

    if (error) {
      logger.error("[FederalBracketsRepository] Error fetching brackets:", error);
      throw new Error(`Failed to fetch federal brackets: ${error.message}`);
    }

    return (brackets || []).map(this.mapToDomain);
  }

  /**
   * Find all federal brackets
   */
  async findAll(): Promise<FederalTaxBracket[]> {
    const supabase = createServiceRoleClient();

    const { data: brackets, error } = await supabase
      .from("system_tax_federal_brackets")
      .select("*")
      .order("countryCode", { ascending: true })
      .order("taxYear", { ascending: false })
      .order("bracketOrder", { ascending: true });

    if (error) {
      logger.error("[FederalBracketsRepository] Error fetching brackets:", error);
      throw new Error(`Failed to fetch federal brackets: ${error.message}`);
    }

    return (brackets || []).map(this.mapToDomain);
  }

  /**
   * Find current (most recent) federal brackets for a country
   */
  async findCurrentByCountry(countryCode: string): Promise<FederalTaxBracket[]> {
    const supabase = createServiceRoleClient();

    // First, get the most recent year for this country
    const { data: yearData, error: yearError } = await supabase
      .from("system_tax_federal_brackets")
      .select("taxYear")
      .eq("countryCode", countryCode)
      .eq("isActive", true)
      .order("taxYear", { ascending: false })
      .limit(1);

    if (yearError || !yearData || yearData.length === 0) {
      return [];
    }

    const currentYear = yearData[0].taxYear;

    // Get brackets for the most recent year
    return this.findByCountryAndYear(countryCode, currentYear);
  }

  /**
   * Find bracket by ID
   */
  async findById(id: string): Promise<FederalTaxBracket | null> {
    const supabase = createServiceRoleClient();

    const { data: bracket, error } = await supabase
      .from("system_tax_federal_brackets")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      logger.error("[FederalBracketsRepository] Error fetching bracket:", error);
      throw new Error(`Failed to fetch federal bracket: ${error.message}`);
    }

    if (!bracket) {
      return null;
    }

    return this.mapToDomain(bracket);
  }

  /**
   * Create a new bracket
   */
  async create(data: {
    countryCode: string;
    taxYear: number;
    bracketOrder: number;
    minIncome: number;
    maxIncome?: number | null;
    taxRate: number;
    isActive?: boolean;
  }): Promise<FederalTaxBracket> {
    const supabase = createServiceRoleClient();

    const { data: bracket, error } = await supabase
      .from("system_tax_federal_brackets")
      .insert({
        countryCode: data.countryCode,
        taxYear: data.taxYear,
        bracketOrder: data.bracketOrder,
        minIncome: data.minIncome,
        maxIncome: data.maxIncome ?? null,
        taxRate: data.taxRate,
        isActive: data.isActive ?? true,
      })
      .select()
      .single();

    if (error) {
      logger.error("[FederalBracketsRepository] Error creating bracket:", error);
      throw new Error(`Failed to create federal bracket: ${error.message}`);
    }

    return this.mapToDomain(bracket);
  }

  /**
   * Update a bracket
   */
  async update(
    id: string,
    data: {
      minIncome?: number;
      maxIncome?: number | null;
      taxRate?: number;
      isActive?: boolean;
    }
  ): Promise<FederalTaxBracket> {
    const supabase = createServiceRoleClient();

    const updateData: any = {};
    if (data.minIncome !== undefined) updateData.minIncome = data.minIncome;
    if (data.maxIncome !== undefined) updateData.maxIncome = data.maxIncome;
    if (data.taxRate !== undefined) updateData.taxRate = data.taxRate;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const { data: bracket, error } = await supabase
      .from("system_tax_federal_brackets")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("[FederalBracketsRepository] Error updating bracket:", error);
      throw new Error(`Failed to update federal bracket: ${error.message}`);
    }

    return this.mapToDomain(bracket);
  }

  /**
   * Delete a bracket
   */
  async delete(id: string): Promise<void> {
    const supabase = createServiceRoleClient();

    const { error } = await supabase
      .from("system_tax_federal_brackets")
      .delete()
      .eq("id", id);

    if (error) {
      logger.error("[FederalBracketsRepository] Error deleting bracket:", error);
      throw new Error(`Failed to delete federal bracket: ${error.message}`);
    }
  }

  /**
   * Map database row to domain type
   */
  private mapToDomain(row: FederalBracketRow): FederalTaxBracket {
    return {
      id: row.id,
      countryCode: row.countryCode as "US" | "CA",
      taxYear: row.taxYear,
      bracketOrder: row.bracketOrder,
      minIncome: Number(row.minIncome),
      maxIncome: row.maxIncome ? Number(row.maxIncome) : null,
      taxRate: Number(row.taxRate),
      isActive: row.isActive,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}

