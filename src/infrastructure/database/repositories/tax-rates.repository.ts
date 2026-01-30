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
  countryCode: string;
  stateOrProvinceCode: string;
  taxRate: number;
  displayName: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export class TaxRatesRepository {
  /**
   * Find all tax rates
   * Uses service role client to bypass RLS (admin-only feature)
   */
  async findAll(): Promise<TaxRate[]> {
    const supabase = createServiceRoleClient();

    const { data: rates, error } = await supabase
      .from("system_tax_rates")
      .select("*")
      .order("countryCode", { ascending: true })
      .order("stateOrProvinceCode", { ascending: true });

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
      .from("system_tax_rates")
      .select("*")
      .eq("countryCode", countryCode)
      .eq("stateOrProvinceCode", stateOrProvinceCode)
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
      .from("system_tax_rates")
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
      .from("system_tax_rates")
      .insert({
        countryCode: data.countryCode,
        stateOrProvinceCode: data.stateOrProvinceCode,
        taxRate: data.taxRate,
        displayName: data.displayName,
        description: data.description ?? null,
        isActive: data.isActive ?? true,
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
    if (data.taxRate !== undefined) updateData.taxRate = data.taxRate;
    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const { data: rate, error } = await supabase
      .from("system_tax_rates")
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
      .from("system_tax_rates")
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
      countryCode: row.countryCode as "US" | "CA",
      stateOrProvinceCode: row.stateOrProvinceCode,
      taxRate: Number(row.taxRate),
      displayName: row.displayName,
      description: row.description,
      isActive: row.isActive,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}

