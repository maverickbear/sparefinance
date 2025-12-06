/**
 * Federal Tax Brackets Repository
 * Data access layer for federal tax brackets
 */

import { createServerClient } from "../supabase-server";
import { FederalTaxBracket } from "@/src/domain/taxes/federal-brackets.types";
import { logger } from "@/src/infrastructure/utils/logger";

export interface FederalBracketRow {
  id: string;
  country_code: string;
  tax_year: number;
  bracket_order: number;
  min_income: number;
  max_income: number | null;
  tax_rate: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export class FederalBracketsRepository {
  /**
   * Find all federal brackets for a country and year
   */
  async findByCountryAndYear(
    countryCode: string,
    taxYear: number
  ): Promise<FederalTaxBracket[]> {
    const supabase = await createServerClient();

    const { data: brackets, error } = await supabase
      .from("federal_tax_brackets")
      .select("*")
      .eq("country_code", countryCode)
      .eq("tax_year", taxYear)
      .eq("is_active", true)
      .order("bracket_order", { ascending: true });

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
    const supabase = await createServerClient();

    const { data: brackets, error } = await supabase
      .from("federal_tax_brackets")
      .select("*")
      .order("country_code", { ascending: true })
      .order("tax_year", { ascending: false })
      .order("bracket_order", { ascending: true });

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
    const supabase = await createServerClient();

    // First, get the most recent year for this country
    const { data: yearData, error: yearError } = await supabase
      .from("federal_tax_brackets")
      .select("tax_year")
      .eq("country_code", countryCode)
      .eq("is_active", true)
      .order("tax_year", { ascending: false })
      .limit(1);

    if (yearError || !yearData || yearData.length === 0) {
      return [];
    }

    const currentYear = yearData[0].tax_year;

    // Get brackets for the most recent year
    return this.findByCountryAndYear(countryCode, currentYear);
  }

  /**
   * Find bracket by ID
   */
  async findById(id: string): Promise<FederalTaxBracket | null> {
    const supabase = await createServerClient();

    const { data: bracket, error } = await supabase
      .from("federal_tax_brackets")
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
    const supabase = await createServerClient();

    const { data: bracket, error } = await supabase
      .from("federal_tax_brackets")
      .insert({
        country_code: data.countryCode,
        tax_year: data.taxYear,
        bracket_order: data.bracketOrder,
        min_income: data.minIncome,
        max_income: data.maxIncome ?? null,
        tax_rate: data.taxRate,
        is_active: data.isActive ?? true,
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
    const supabase = await createServerClient();

    const updateData: any = {};
    if (data.minIncome !== undefined) updateData.min_income = data.minIncome;
    if (data.maxIncome !== undefined) updateData.max_income = data.maxIncome;
    if (data.taxRate !== undefined) updateData.tax_rate = data.taxRate;
    if (data.isActive !== undefined) updateData.is_active = data.isActive;

    const { data: bracket, error } = await supabase
      .from("federal_tax_brackets")
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
    const supabase = await createServerClient();

    const { error } = await supabase
      .from("federal_tax_brackets")
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
      countryCode: row.country_code as "US" | "CA",
      taxYear: row.tax_year,
      bracketOrder: row.bracket_order,
      minIncome: Number(row.min_income),
      maxIncome: row.max_income ? Number(row.max_income) : null,
      taxRate: Number(row.tax_rate),
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

