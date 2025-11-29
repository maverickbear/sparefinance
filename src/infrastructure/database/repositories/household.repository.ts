/**
 * Household Repository
 * Data access layer for households - only handles database operations
 * No business logic here
 */

import { createServerClient } from "../supabase-server";
import { logger } from "@/lib/utils/logger";
import { HouseholdSettings } from "@/src/domain/household/household.types";

export interface HouseholdRow {
  id: string;
  name: string;
  type: "personal" | "household";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  settings: Record<string, unknown> | null;
}

export class HouseholdRepository {
  /**
   * Find household by ID
   */
  async findById(
    householdId: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<HouseholdRow | null> {
    const supabase = await createServerClient(accessToken, refreshToken);

    const { data: household, error } = await supabase
      .from("Household")
      .select("*")
      .eq("id", householdId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Not found
      }
      logger.error("[HouseholdRepository] Error fetching household:", error);
      throw new Error(`Failed to fetch household: ${error.message}`);
    }

    return household as HouseholdRow;
  }

  /**
   * Get household settings
   */
  async getSettings(
    householdId: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<HouseholdSettings | null> {
    const household = await this.findById(householdId, accessToken, refreshToken);
    if (!household) {
      return null;
    }

    return (household.settings || {}) as HouseholdSettings;
  }

  /**
   * Update household settings
   */
  async updateSettings(
    householdId: string,
    settings: Record<string, unknown>,
    accessToken?: string,
    refreshToken?: string
  ): Promise<HouseholdRow> {
    const supabase = await createServerClient(accessToken, refreshToken);
    const now = new Date().toISOString();

    const { data: household, error } = await supabase
      .from("Household")
      .update({
        settings,
        updatedAt: now,
      })
      .eq("id", householdId)
      .select()
      .single();

    if (error) {
      logger.error("[HouseholdRepository] Error updating household settings:", error);
      throw new Error(`Failed to update household settings: ${error.message}`);
    }

    if (!household) {
      throw new Error("Household not found");
    }

    return household as HouseholdRow;
  }
}

