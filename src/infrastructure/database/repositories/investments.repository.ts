/**
 * Investments Repository
 * Data access layer for investments - only handles database operations
 * No business logic here
 */

import { createServerClient } from "../supabase-server";
import { logger } from "@/src/infrastructure/utils/logger";
import { formatDateOnly, formatDateStart, formatDateEnd, formatTimestamp } from "@/src/infrastructure/utils/timestamp";

export interface InvestmentTransactionRow {
  id: string;
  date: string;
  type: "buy" | "sell" | "dividend" | "interest" | "transfer_in" | "transfer_out";
  quantity: number | null;
  price: number | null;
  fees: number;
  notes: string | null;
  securityId: string | null;
  accountId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SecurityRow {
  id: string;
  symbol: string;
  name: string;
  class: string;
  sector: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SecurityPriceRow {
  id: string;
  securityId: string;
  date: string;
  price: number;
  createdAt: string;
}

export interface PositionRow {
  securityId: string;
  accountId: string;
  openQuantity: number;
  averageEntryPrice: number;
  totalCost: number;
  currentPrice: number;
  currentMarketValue: number;
  openPnl: number;
  lastUpdatedAt: string;
}

export class InvestmentsRepository {
  /**
   * Find all investment transactions with optional filters
   */
  async findTransactions(
    filters?: {
      accountId?: string;
      securityId?: string;
      startDate?: Date;
      endDate?: Date;
    },
    accessToken?: string,
    refreshToken?: string
  ): Promise<InvestmentTransactionRow[]> {
    const supabase = await createServerClient(accessToken, refreshToken);

    let query = supabase
      .from("InvestmentTransaction")
      .select("id, date, type, quantity, price, fees, notes, securityId, accountId, createdAt, updatedAt")
      .order("date", { ascending: false });

    if (filters?.accountId) {
      query = query.eq("accountId", filters.accountId);
    }

    if (filters?.securityId) {
      query = query.eq("securityId", filters.securityId);
    }

    if (filters?.startDate) {
      query = query.gte("date", formatDateStart(filters.startDate));
    }

    if (filters?.endDate) {
      query = query.lte("date", formatDateEnd(filters.endDate));
    }

    const { data, error } = await query;

    if (error) {
      logger.error("[InvestmentsRepository] Error fetching transactions:", error);
      throw new Error(`Failed to fetch transactions: ${error.message}`);
    }

    return (data || []) as InvestmentTransactionRow[];
  }

  /**
   * Find investment transaction by ID
   */
  async findTransactionById(
    id: string
  ): Promise<InvestmentTransactionRow | null> {
    const supabase = await createServerClient();

    const { data: transaction, error } = await supabase
      .from("InvestmentTransaction")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      logger.error("[InvestmentsRepository] Error fetching transaction:", error);
      throw new Error(`Failed to fetch transaction: ${error.message}`);
    }

    return transaction as InvestmentTransactionRow;
  }

  /**
   * Create an investment transaction
   */
  async createTransaction(data: {
    id: string;
    date: string;
    accountId: string;
    securityId: string | null;
    type: "buy" | "sell" | "dividend" | "interest" | "transfer_in" | "transfer_out";
    quantity: number | null;
    price: number | null;
    fees: number;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
  }): Promise<InvestmentTransactionRow> {
    const supabase = await createServerClient();

    const { data: transaction, error } = await supabase
      .from("InvestmentTransaction")
      .insert(data)
      .select()
      .single();

    if (error) {
      logger.error("[InvestmentsRepository] Error creating transaction:", error);
      throw new Error(`Failed to create transaction: ${error.message}`);
    }

    return transaction as InvestmentTransactionRow;
  }

  /**
   * Update an investment transaction
   */
  async updateTransaction(
    id: string,
    data: Partial<Omit<InvestmentTransactionRow, "id" | "createdAt">>
  ): Promise<InvestmentTransactionRow> {
    const supabase = await createServerClient();

    const { data: transaction, error } = await supabase
      .from("InvestmentTransaction")
      .update({
        ...data,
        updatedAt: formatTimestamp(new Date()),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("[InvestmentsRepository] Error updating transaction:", error);
      throw new Error(`Failed to update transaction: ${error.message}`);
    }

    return transaction as InvestmentTransactionRow;
  }

  /**
   * Delete an investment transaction
   */
  async deleteTransaction(id: string): Promise<void> {
    const supabase = await createServerClient();

    const { error } = await supabase
      .from("InvestmentTransaction")
      .delete()
      .eq("id", id);

    if (error) {
      logger.error("[InvestmentsRepository] Error deleting transaction:", error);
      throw new Error(`Failed to delete transaction: ${error.message}`);
    }
  }

  /**
   * Find all positions
   */
  async findPositions(
    accountId?: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<PositionRow[]> {
    const supabase = await createServerClient(accessToken, refreshToken);

    let query = supabase
      .from("Position")
      .select("securityId, accountId, openQuantity, averageEntryPrice, totalCost, currentPrice, currentMarketValue, openPnl, lastUpdatedAt")
      .gt("openQuantity", 0)
      .order("lastUpdatedAt", { ascending: false });

    if (accountId) {
      query = query.eq("accountId", accountId);
    }

    const { data, error } = await query;

    if (error) {
      logger.error("[InvestmentsRepository] Error fetching positions:", error);
      return [];
    }

    return (data || []) as PositionRow[];
  }

  /**
   * Find all securities
   */
  async findSecurities(): Promise<SecurityRow[]> {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("Security")
      .select("*")
      .order("symbol", { ascending: true });

    if (error) {
      logger.error("[InvestmentsRepository] Error fetching securities:", error);
      return [];
    }

    return (data || []) as SecurityRow[];
  }

  /**
   * Create a security
   */
  async createSecurity(data: {
    id: string;
    symbol: string;
    name: string;
    class: string;
    createdAt: string;
    updatedAt: string;
  }): Promise<SecurityRow> {
    const supabase = await createServerClient();

    const { data: security, error } = await supabase
      .from("Security")
      .insert(data)
      .select()
      .single();

    if (error) {
      logger.error("[InvestmentsRepository] Error creating security:", error);
      throw new Error(`Failed to create security: ${error.message}`);
    }

    return security as SecurityRow;
  }

  /**
   * Find security prices
   */
  async findSecurityPrices(securityId?: string): Promise<SecurityPriceRow[]> {
    const supabase = await createServerClient();

    let query = supabase
      .from("SecurityPrice")
      .select("*")
      .order("date", { ascending: false });

    if (securityId) {
      query = query.eq("securityId", securityId);
    }

    const { data, error } = await query;

    if (error) {
      logger.error("[InvestmentsRepository] Error fetching security prices:", error);
      return [];
    }

    return (data || []) as SecurityPriceRow[];
  }

  /**
   * Create a security price
   */
  async createSecurityPrice(data: {
    id: string;
    securityId: string;
    date: string;
    price: number;
    createdAt: string;
  }): Promise<SecurityPriceRow> {
    const supabase = await createServerClient();

    const { data: price, error } = await supabase
      .from("SecurityPrice")
      .insert(data)
      .select()
      .single();

    if (error) {
      logger.error("[InvestmentsRepository] Error creating security price:", error);
      throw new Error(`Failed to create security price: ${error.message}`);
    }

    return price as SecurityPriceRow;
  }

  /**
   * Find investment accounts (accounts with type "investment")
   */
  async findInvestmentAccounts(
    accessToken?: string,
    refreshToken?: string
  ): Promise<Array<{ id: string; name: string; type: string; userId: string; householdId: string | null; createdAt: string; updatedAt: string }>> {
    const supabase = await createServerClient(accessToken, refreshToken);

    const { data, error } = await supabase
      .from("Account")
      .select("*")
      .eq("type", "investment")
      .order("name", { ascending: true });

    if (error) {
      logger.error("[InvestmentsRepository] Error fetching investment accounts:", error);
      return [];
    }

    return (data || []) as Array<{ id: string; name: string; type: string; userId: string; householdId: string | null; createdAt: string; updatedAt: string }>;
  }
}

