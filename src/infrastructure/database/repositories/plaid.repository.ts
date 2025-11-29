/**
 * Plaid Repository
 * Data access layer for Plaid connections
 */

import { createServerClient } from "../supabase-server";
import { PlaidConnection } from "../../../domain/plaid/plaid.types";
import { logger } from "@/src/infrastructure/utils/logger";

export class PlaidRepository {
  /**
   * Get Plaid connection by item ID
   */
  async getConnectionByItemId(itemId: string): Promise<PlaidConnection | null> {
    const supabase = await createServerClient();

    const { data: connection, error } = await supabase
      .from("PlaidConnection")
      .select("*")
      .eq("itemId", itemId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Not found
      }
      logger.error("[PlaidRepository] Error fetching connection:", error);
      throw new Error(`Failed to fetch Plaid connection: ${error.message}`);
    }

    if (!connection) {
      return null;
    }

    return {
      id: connection.id,
      userId: connection.userId,
      itemId: connection.itemId,
      accessToken: connection.accessToken,
      institutionId: connection.institutionId || null,
      institutionName: connection.institutionName || null,
      transactionsCursor: connection.transactionsCursor || null,
      createdAt: new Date(connection.createdAt),
      updatedAt: new Date(connection.updatedAt),
    };
  }

  /**
   * Get Plaid connection by user ID
   */
  async getConnectionsByUserId(userId: string): Promise<PlaidConnection[]> {
    const supabase = await createServerClient();

    const { data: connections, error } = await supabase
      .from("PlaidConnection")
      .select("*")
      .eq("userId", userId)
      .order("createdAt", { ascending: false });

    if (error) {
      logger.error("[PlaidRepository] Error fetching connections:", error);
      throw new Error(`Failed to fetch Plaid connections: ${error.message}`);
    }

    return (connections || []).map((conn) => ({
      id: conn.id,
      userId: conn.userId,
      itemId: conn.itemId,
      accessToken: conn.accessToken,
      institutionId: conn.institutionId || null,
      institutionName: conn.institutionName || null,
      transactionsCursor: conn.transactionsCursor || null,
      createdAt: new Date(conn.createdAt),
      updatedAt: new Date(conn.updatedAt),
    }));
  }

  /**
   * Create a Plaid connection
   */
  async createConnection(data: {
    userId: string;
    itemId: string;
    accessToken: string;
    institutionId?: string | null;
    institutionName?: string | null;
    transactionsCursor?: string | null;
  }): Promise<PlaidConnection> {
    const supabase = await createServerClient();

    const { data: connection, error } = await supabase
      .from("PlaidConnection")
      .insert({
        userId: data.userId,
        itemId: data.itemId,
        accessToken: data.accessToken,
        institutionId: data.institutionId || null,
        institutionName: data.institutionName || null,
        transactionsCursor: data.transactionsCursor || null,
      })
      .select()
      .single();

    if (error) {
      logger.error("[PlaidRepository] Error creating connection:", error);
      throw new Error(`Failed to create Plaid connection: ${error.message}`);
    }

    return {
      id: connection.id,
      userId: connection.userId,
      itemId: connection.itemId,
      accessToken: connection.accessToken,
      institutionId: connection.institutionId || null,
      institutionName: connection.institutionName || null,
      transactionsCursor: connection.transactionsCursor || null,
      createdAt: new Date(connection.createdAt),
      updatedAt: new Date(connection.updatedAt),
    };
  }

  /**
   * Update Plaid connection cursor
   */
  async updateCursor(itemId: string, cursor: string | null): Promise<void> {
    const supabase = await createServerClient();

    const { error } = await supabase
      .from("PlaidConnection")
      .update({
        transactionsCursor: cursor,
        updatedAt: new Date().toISOString(),
      })
      .eq("itemId", itemId);

    if (error) {
      logger.error("[PlaidRepository] Error updating cursor:", error);
      throw new Error(`Failed to update Plaid cursor: ${error.message}`);
    }
  }

  /**
   * Delete Plaid connection
   */
  async deleteConnection(itemId: string): Promise<void> {
    const supabase = await createServerClient();

    const { error } = await supabase
      .from("PlaidConnection")
      .delete()
      .eq("itemId", itemId);

    if (error) {
      logger.error("[PlaidRepository] Error deleting connection:", error);
      throw new Error(`Failed to delete Plaid connection: ${error.message}`);
    }
  }
}

