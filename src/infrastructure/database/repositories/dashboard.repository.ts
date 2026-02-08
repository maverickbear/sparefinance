/**
 * Dashboard Repository
 * Data access layer for dashboard operations - only handles database operations.
 *
 * Dashboard version: max(updated_at) across all dashboard-related tables for the user.
 * With RLS, queries are scoped to the authenticated user; users table is scoped by id.
 */

import { createServerClient } from "../supabase-server";
import { logger } from "@/src/infrastructure/utils/logger";

/** Tables that feed the dashboard; all are scoped by RLS except users (scoped by userId). */
const DASHBOARD_TABLES = [
  "transactions",
  "accounts",
  "budgets",
  "goals",
  "debts",
  "planned_payments",
  "user_subscriptions",
] as const;

export class DashboardRepository {
  /**
   * Get the maximum updated_at timestamp from transactions only.
   * Used by legacy checkUpdates() for backward compatibility.
   */
  async getMaxUpdatedAt(): Promise<number | null> {
    const supabase = await createServerClient();

    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("updated_at")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        logger.warn("[DashboardRepository] Error getting max updated_at:", error);
        return Date.now();
      }

      if (!data?.updated_at) {
        return Date.now();
      }

      return new Date(data.updated_at).getTime();
    } catch (err) {
      logger.warn("[DashboardRepository] Error getting max updated_at:", err);
      return Date.now();
    }
  }

  /**
   * Get dashboard version: max(updated_at) across all dashboard-related tables for the given user.
   * Reflects changes in transactions, accounts, budgets, goals, debts, planned_payments,
   * user_subscriptions, users (onboarding), and the user's household (expected income, etc.).
   */
  async getDashboardVersion(
    userId: string,
    householdId?: string | null
  ): Promise<string> {
    const supabase = await createServerClient();

    const getMaxFromTable = async (
      table: string,
      extraFilter?: { column: string; value: string }
    ): Promise<number | null> => {
      let query = supabase
        .from(table)
        .select("updated_at")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (extraFilter) {
        query = query.eq(extraFilter.column, extraFilter.value);
      }

      const { data, error } = await query;
      if (error) {
        logger.debug(`[DashboardRepository] ${table} max updated_at: ${error.message}`);
        return null;
      }
      if (!data?.updated_at) return null;
      return new Date(data.updated_at).getTime();
    };

    try {
      const queries: Promise<number | null>[] = [
        ...DASHBOARD_TABLES.map((table) => getMaxFromTable(table)),
        getMaxFromTable("users", { column: "id", value: userId }),
      ];
      if (householdId) {
        queries.push(getMaxFromTable("households", { column: "id", value: householdId }));
      }

      const results = await Promise.all(queries);

      const maxTs = results.reduce<number | null>((acc, ts) => {
        if (ts == null) return acc;
        if (acc == null) return ts;
        return Math.max(acc, ts);
      }, null);

      const version = maxTs != null ? new Date(maxTs).toISOString() : new Date().toISOString();
      return version;
    } catch (err) {
      logger.warn("[DashboardRepository] Error getting dashboard version:", err);
      return new Date().toISOString();
    }
  }
}

