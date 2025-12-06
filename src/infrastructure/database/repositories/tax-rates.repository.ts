/**
 * Tax Rates Repository
 * Data access layer for tax rates - only handles database operations
 * No business logic here
 */

import { createServiceRoleClient } from "../supabase-server";
import { TaxRate } from "@/src/domain/taxes/tax-rates.types";
import { logger } from "@/src/infrastructure/utils/logger";

export interface TaxRateRow {
  id: string;
  country_code: string;
  state_or_province_code: string;
  tax_rate: number;
  display_name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export class TaxRatesRepository {
  /**
   * Find all tax rates
   * Uses service role client to bypass RLS (admin-only feature)
   */
  async findAll(): Promise<TaxRate[]> {
    const supabase = createServiceRoleClient();

    const { data: rates, error } = await supabase
      .from("tax_rates")
      .select("*")
      .order("country_code", { ascending: true })
      .order("state_or_province_code", { ascending: true });

    if (error) {
      logger.error("[TaxRatesRepository] Error fetching tax rates:", error);
      throw new Error(`Failed to fetch tax rates: ${error.message}`);
    }

    return (rates || []).map(this.mapToDomain);
  }

  /**
   * Find tax rate by country and state/province
   * Uses service role client to bypass RLS (admin-only feature)
   */
  async findByCountryAndState(
    countryCode: string,
    stateOrProvinceCode: string
  ): Promise<TaxRate | null> {
    const supabase = createServiceRoleClient();

    const { data: rate, error } = await supabase
      .from("tax_rates")
      .select("*")
      .eq("country_code", countryCode)
      .eq("state_or_province_code", stateOrProvinceCode)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Not found
      }
      logger.error("[TaxRatesRepository] Error fetching tax rate:", error);
      throw new Error(`Failed to fetch tax rate: ${error.message}`);
    }

    if (!rate) {
      return null;
    }

    return this.mapToDomain(rate);
  }

  /**
   * Find tax rate by ID
   * Uses service role client to bypass RLS (admin-only feature)
   */
  async findById(id: string): Promise<TaxRate | null> {
    const supabase = createServiceRoleClient();

    const { data: rate, error } = await supabase
      .from("tax_rates")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Not found
      }
      logger.error("[TaxRatesRepository] Error fetching tax rate:", error);
      throw new Error(`Failed to fetch tax rate: ${error.message}`);
    }

    if (!rate) {
      return null;
    }

    return this.mapToDomain(rate);
  }

  /**
   * Create a new tax rate
   * Uses service role client to bypass RLS (admin-only feature)
   */
  async create(data: {
    countryCode: string;
    stateOrProvinceCode: string;
    taxRate: number;
    displayName: string;
    description?: string | null;
    isActive?: boolean;
  }): Promise<TaxRate> {
    const supabase = createServiceRoleClient();

    const { data: rate, error } = await supabase
      .from("tax_rates")
      .insert({
        country_code: data.countryCode,
        state_or_province_code: data.stateOrProvinceCode,
        tax_rate: data.taxRate,
        display_name: data.displayName,
        description: data.description ?? null,
        is_active: data.isActive ?? true,
      })
      .select()
      .single();

    if (error) {
      logger.error("[TaxRatesRepository] Error creating tax rate:", error);
      throw new Error(`Failed to create tax rate: ${error.message}`);
    }

    return this.mapToDomain(rate);
  }

  /**
   * Update a tax rate
   * Uses service role client to bypass RLS (admin-only feature)
   */
  async update(
    id: string,
    data: {
      taxRate?: number;
      displayName?: string;
      description?: string | null;
      isActive?: boolean;
    }
  ): Promise<TaxRate> {
    const supabase = createServiceRoleClient();

    const updateData: any = {};
    if (data.taxRate !== undefined) updateData.tax_rate = data.taxRate;
    if (data.displayName !== undefined) updateData.display_name = data.displayName;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.isActive !== undefined) updateData.is_active = data.isActive;

    const { data: rate, error } = await supabase
      .from("tax_rates")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("[TaxRatesRepository] Error updating tax rate:", error);
      throw new Error(`Failed to update tax rate: ${error.message}`);
    }

    return this.mapToDomain(rate);
  }

  /**
   * Delete a tax rate
   * Uses service role client to bypass RLS (admin-only feature)
   */
  async delete(id: string): Promise<void> {
    const supabase = createServiceRoleClient();

    const { error } = await supabase
      .from("tax_rates")
      .delete()
      .eq("id", id);

    if (error) {
      logger.error("[TaxRatesRepository] Error deleting tax rate:", error);
      throw new Error(`Failed to delete tax rate: ${error.message}`);
    }
  }

  /**
   * Map database row to domain type
   */
  private mapToDomain(row: TaxRateRow): TaxRate {
    return {
      id: row.id,
      countryCode: row.country_code as "US" | "CA",
      stateOrProvinceCode: row.state_or_province_code,
      taxRate: Number(row.tax_rate),
      displayName: row.display_name,
      description: row.description,
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

