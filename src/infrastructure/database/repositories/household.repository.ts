/**
 * Household Repository
 * Data access layer for households - only handles database operations
 * No business logic here
 */

import { createServerClient } from "../supabase-server";
import { logger } from "@/src/infrastructure/utils/logger";
import { HouseholdSettings } from "@/src/domain/household/household.types";
import { formatTimestamp } from "@/src/infrastructure/utils/timestamp";

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

  /**
   * Create a new household
   */
  async create(data: {
    name: string;
    type: "personal" | "household";
    createdBy: string;
  }): Promise<HouseholdRow> {
    const supabase = await createServerClient();
    const now = formatTimestamp(new Date());

    const { data: household, error } = await supabase
      .from("Household")
      .insert({
        name: data.name,
        type: data.type,
        createdBy: data.createdBy,
        createdAt: now,
        updatedAt: now,
        settings: {},
      })
      .select()
      .single();

    if (error || !household) {
      logger.error("[HouseholdRepository] Error creating household:", error);
      throw new Error(`Failed to create household: ${error?.message || "Unknown error"}`);
    }

    return household as HouseholdRow;
  }

  /**
   * Set active household for a user
   */
  async setActiveHousehold(
    userId: string,
    householdId: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<void> {
    const supabase = await createServerClient(accessToken, refreshToken);
    const now = formatTimestamp(new Date());

    // Verify user is a member of this household
    const { data: member, error: memberError } = await supabase
      .from("HouseholdMember")
      .select("id")
      .eq("householdId", householdId)
      .eq("userId", userId)
      .eq("status", "active")
      .single();

    if (memberError || !member) {
      throw new Error("User is not an active member of this household");
    }

    const { error } = await supabase
      .from("UserActiveHousehold")
      .upsert({
        userId,
        householdId,
        updatedAt: now,
      });

    if (error) {
      logger.error("[HouseholdRepository] Error setting active household:", error);
      throw new Error(`Failed to set active household: ${error.message}`);
    }
  }

  /**
   * Delete household by ID
   */
  async delete(householdId: string): Promise<void> {
    const supabase = await createServerClient();

    const { error } = await supabase
      .from("Household")
      .delete()
      .eq("id", householdId);

    if (error) {
      logger.error("[HouseholdRepository] Error deleting household:", error);
      throw new Error(`Failed to delete household: ${error.message}`);
    }
  }
}

