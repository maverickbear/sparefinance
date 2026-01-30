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
  security_id: string | null;
  account_id: string;
  created_at: string;
  updated_at: string;
}

export interface SecurityRow {
  id: string;
  symbol: string;
  name: string;
  class: string;
  sector: string | null;
  created_at: string;
  updated_at: string;
}

export interface SecurityPriceRow {
  id: string;
  security_id: string;
  date: string;
  price: number;
  created_at: string;
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
      .from("investment_transactions")
      .select("id, date, type, quantity, price, fees, notes, security_id, account_id, created_at, updated_at")
      .order("date", { ascending: false });

    if (filters?.accountId) {
      query = query.eq("account_id", filters.accountId);
    }

    if (filters?.securityId) {
      query = query.eq("security_id", filters.securityId);
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
      .from("investment_transactions")
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

    const insertData: {
      id: string;
      date: string;
      account_id: string;
      security_id: string | null;
      type: string;
      quantity: number | null;
      price: number | null;
      fees: number;
      notes: string | null;
      created_at: string;
      updated_at: string;
    } = {
      id: data.id,
      date: data.date,
      account_id: data.accountId,
      security_id: data.securityId,
      type: data.type,
      quantity: data.quantity,
      price: data.price,
      fees: data.fees,
      notes: data.notes,
      created_at: data.createdAt,
      updated_at: data.updatedAt,
    };

    const { data: transaction, error } = await supabase
      .from("investment_transactions")
      .insert(insertData)
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
   * Receives camelCase parameters and maps to snake_case for database
   */
  async updateTransaction(
    id: string,
    data: Partial<{
      date: string;
      type: string;
      quantity: number | null;
      price: number | null;
      fees: number;
      notes: string | null;
      securityId: string | null;
      accountId: string;
    }>
  ): Promise<InvestmentTransactionRow> {
    const supabase = await createServerClient();

    // Map camelCase to snake_case for database
    const updateData: {
      date?: string;
      type?: string;
      quantity?: number | null;
      price?: number | null;
      fees?: number;
      notes?: string | null;
      security_id?: string | null;
      account_id?: string;
      updated_at: string;
    } = {
      updated_at: formatTimestamp(new Date()),
    };
    if (data.date !== undefined) updateData.date = data.date;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.quantity !== undefined) updateData.quantity = data.quantity;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.fees !== undefined) updateData.fees = data.fees;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.securityId !== undefined) updateData.security_id = data.securityId;
    if (data.accountId !== undefined) updateData.account_id = data.accountId;

    const { data: transaction, error } = await supabase
      .from("investment_transactions")
      .update(updateData)
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
      .from("investment_transactions")
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
      .from("positions")
      .select("security_id, account_id, open_quantity, average_entry_price, total_cost, current_price, current_market_value, open_pnl, last_updated_at")
      .gt("open_quantity", 0)
      .order("last_updated_at", { ascending: false });

    if (accountId) {
      query = query.eq("account_id", accountId);
    }

    const { data, error } = await query;

    if (error) {
      logger.error("[InvestmentsRepository] Error fetching positions:", error);
      return [];
    }

    // Map snake_case database columns to camelCase interface
    return (data || []).map((row: any) => ({
      securityId: row.security_id,
      accountId: row.account_id,
      openQuantity: row.open_quantity,
      averageEntryPrice: row.average_entry_price,
      totalCost: row.total_cost,
      currentPrice: row.current_price,
      currentMarketValue: row.current_market_value,
      openPnl: row.open_pnl,
      lastUpdatedAt: row.last_updated_at,
    })) as PositionRow[];
  }

  /**
   * Find all securities
   */
  async findSecurities(): Promise<SecurityRow[]> {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("securities")
      .select("*")
      .order("symbol", { ascending: true });

    if (error) {
      logger.error("[InvestmentsRepository] Error fetching securities:", error);
      return [];
    }

    return (data || []) as SecurityRow[];
  }

  /**
   * Find securities by IDs
   */
  async findSecuritiesByIds(
    securityIds: string[],
    accessToken?: string,
    refreshToken?: string
  ): Promise<SecurityRow[]> {
    if (securityIds.length === 0) {
      return [];
    }

    const supabase = await createServerClient(accessToken, refreshToken);

    const { data, error } = await supabase
      .from("securities")
      .select("id, symbol, name, class, sector")
      .in("id", securityIds);

    if (error) {
      logger.error("[InvestmentsRepository] Error fetching securities by IDs:", error);
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

    const insertData: {
      id: string;
      symbol: string;
      name: string;
      class: string;
      created_at: string;
      updated_at: string;
    } = {
      id: data.id,
      symbol: data.symbol,
      name: data.name,
      class: data.class,
      created_at: data.createdAt,
      updated_at: data.updatedAt,
    };

    const { data: security, error } = await supabase
      .from("securities")
      .insert(insertData)
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
      .from("security_prices")
      .select("*")
      .order("date", { ascending: false });

    if (securityId) {
      query = query.eq("security_id", securityId);
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

    const insertData: {
      id: string;
      security_id: string;
      date: string;
      price: number;
      created_at: string;
    } = {
      id: data.id,
      security_id: data.securityId,
      date: data.date,
      price: data.price,
      created_at: data.createdAt,
    };

    const { data: price, error } = await supabase
      .from("security_prices")
      .insert(insertData)
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
  ): Promise<Array<{ id: string; name: string; type: string; user_id: string; household_id: string | null; created_at: string; updated_at: string }>> {
    const supabase = await createServerClient(accessToken, refreshToken);

    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .eq("type", "investment")
      .order("name", { ascending: true });

    if (error) {
      // Handle permission denied errors gracefully (can happen during SSR)
      if (error.code === '42501' || error.message?.includes('permission denied')) {
        logger.warn("[InvestmentsRepository] Permission denied fetching investment accounts - user may not be authenticated");
        return [];
      }
      logger.error("[InvestmentsRepository] Error fetching investment accounts:", error);
      return [];
    }

    return (data || []) as Array<{ id: string; name: string; type: string; user_id: string; household_id: string | null; created_at: string; updated_at: string }>;
  }

  /**
   * Get investment account data by account IDs
   */
  async getInvestmentAccountData(
    accountIds: string[],
    accessToken?: string,
    refreshToken?: string
  ): Promise<Array<{ account_id: string; total_equity: number | null; market_value: number | null; cash: number | null }>> {
    if (accountIds.length === 0) {
      return [];
    }

    const supabase = await createServerClient(accessToken, refreshToken);

    const { data, error } = await supabase
      .from("investment_accounts")
      .select("account_id, total_equity, market_value, cash")
      .in("account_id", accountIds)
      .not("account_id", "is", null);

    if (error) {
      logger.error("[InvestmentsRepository] Error fetching investment account data:", error);
      return [];
    }

    return (data || []) as Array<{ account_id: string; total_equity: number | null; market_value: number | null; cash: number | null }>;
  }

  /**
   * Get account investment values by account IDs
   */
  async getAccountInvestmentValues(
    accountIds: string[],
    accessToken?: string,
    refreshToken?: string
  ): Promise<Array<{ account_id: string; totalValue: number }>> {
    if (accountIds.length === 0) {
      return [];
    }

    const supabase = await createServerClient(accessToken, refreshToken);

    const { data, error } = await supabase
      .from("account_investment_values")
      .select("account_id, market_value")
      .in("account_id", accountIds);

    if (error) {
      logger.error("[InvestmentsRepository] Error fetching account investment values:", error);
      return [];
    }

    return (data || []).map((row: { account_id: string; market_value: number | null }) => ({
      account_id: row.account_id,
      totalValue: row.market_value || 0,
    }));
  }

  /**
   * Get investment account mapping (InvestmentAccount.id to Account.id)
   */
  async getInvestmentAccountMapping(
    accountIds: string[],
    accessToken?: string,
    refreshToken?: string
  ): Promise<Map<string, string>> {
    if (accountIds.length === 0) {
      return new Map();
    }

    const supabase = await createServerClient(accessToken, refreshToken);

    const { data, error } = await supabase
      .from("investment_accounts")
      .select("id, account_id")
      .in("account_id", accountIds)
      .not("account_id", "is", null);

    if (error) {
      logger.error("[InvestmentsRepository] Error fetching investment account mapping:", error);
      return new Map();
    }

    const map = new Map<string, string>();
    data?.forEach((ia: { id: string; account_id: string | null }) => {
      if (ia.account_id) {
        map.set(ia.id, ia.account_id);
      }
    });

    return map;
  }

  /**
   * Find all investment holdings for a user
   */
  async findHoldings(
    userId: string,
    accountId?: string
  ): Promise<Array<{
    id: string;
    account_id: string;
    symbol: string;
    quantity: number;
    average_price: number;
    current_price: number;
    last_price_update_at: string | null;
    created_at: string;
    updated_at: string;
  }>> {
    const supabase = await createServerClient();

    let query = supabase
      .from("investment_holdings")
      .select("*")
      .eq("user_id", userId);

    if (accountId) {
      query = query.eq("account_id", accountId);
    }

    const { data, error } = await query.order("symbol", { ascending: true });

    if (error) {
      logger.error("[InvestmentsRepository] Error fetching holdings:", error);
      return [];
    }

    return (data || []) as Array<{
      id: string;
      account_id: string;
      symbol: string;
      quantity: number;
      average_price: number;
      current_price: number;
      last_price_update_at: string | null;
      created_at: string;
      updated_at: string;
    }>;
  }

  /**
   * Upsert investment holdings (insert or update)
   */
  async upsertHoldings(
    userId: string,
    accountId: string,
    holdings: Array<{
      symbol: string;
      quantity: number;
      averagePrice: number;
      currentPrice: number;
    }>
  ): Promise<void> {
    const supabase = await createServerClient();

    const holdingsData = holdings.map((holding) => ({
      id: `${accountId}-${holding.symbol}`,
      account_id: accountId,
      user_id: userId,
      symbol: holding.symbol,
      quantity: holding.quantity,
      average_price: holding.averagePrice,
      current_price: holding.currentPrice,
      last_price_update_at: formatTimestamp(new Date()),
      updated_at: formatTimestamp(new Date()),
    }));

    const { error } = await supabase
      .from("investment_holdings")
      .upsert(holdingsData, {
        onConflict: "id",
      });

    if (error) {
      logger.error("[InvestmentsRepository] Error upserting holdings:", error);
      throw new Error(`Failed to upsert holdings: ${error.message}`);
    }
  }

  /**
   * Update holding price
   */
  async updateHoldingPrice(
    holdingId: string,
    price: number
  ): Promise<void> {
    const supabase = await createServerClient();

    const { error } = await supabase
      .from("investment_holdings")
      .update({
        current_price: price,
        last_price_update_at: formatTimestamp(new Date()),
        updated_at: formatTimestamp(new Date()),
      })
      .eq("id", holdingId);

    if (error) {
      logger.error("[InvestmentsRepository] Error updating holding price:", error);
      throw new Error(`Failed to update holding price: ${error.message}`);
    }
  }

  /**
   * Find all manual investments for a user
   */
  async findManualInvestments(
    userId: string
  ): Promise<Array<{
    id: string;
    user_id: string;
    title: string;
    current_value: number;
    estimated_growth: number | null;
    last_updated_at: string;
    created_at: string;
    updated_at: string;
  }>> {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("manual_investments")
      .select("*")
      .eq("user_id", userId)
      .order("title", { ascending: true });

    if (error) {
      logger.error("[InvestmentsRepository] Error fetching manual investments:", error);
      return [];
    }

    return (data || []) as Array<{
      id: string;
      user_id: string;
      title: string;
      current_value: number;
      estimated_growth: number | null;
      last_updated_at: string;
      created_at: string;
      updated_at: string;
    }>;
  }

  /**
   * Create a manual investment
   */
  async createManualInvestment(
    userId: string,
    data: {
      id: string;
      title: string;
      currentValue: number;
      estimatedGrowth: number | null;
    }
  ): Promise<{
    id: string;
    user_id: string;
    title: string;
    current_value: number;
    estimated_growth: number | null;
    last_updated_at: string;
    created_at: string;
    updated_at: string;
  }> {
    const supabase = await createServerClient();

    const insertData = {
      id: data.id,
      user_id: userId,
      title: data.title,
      current_value: data.currentValue,
      estimated_growth: data.estimatedGrowth,
      last_updated_at: formatTimestamp(new Date()),
      created_at: formatTimestamp(new Date()),
      updated_at: formatTimestamp(new Date()),
    };

    const { data: investment, error } = await supabase
      .from("manual_investments")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      logger.error("[InvestmentsRepository] Error creating manual investment:", error);
      throw new Error(`Failed to create manual investment: ${error.message}`);
    }

    return investment as {
      id: string;
      user_id: string;
      title: string;
      current_value: number;
      estimated_growth: number | null;
      last_updated_at: string;
      created_at: string;
      updated_at: string;
    };
  }

  /**
   * Update a manual investment
   */
  async updateManualInvestment(
    id: string,
    data: {
      title?: string;
      currentValue?: number;
      estimatedGrowth?: number | null;
    }
  ): Promise<void> {
    const supabase = await createServerClient();

    const updateData: {
      updated_at: string;
      title?: string;
      current_value?: number;
      estimated_growth?: number;
      last_updated_at?: string;
    } = {
      updated_at: formatTimestamp(new Date()),
    };

    if (data.title !== undefined) updateData.title = data.title;
    if (data.currentValue !== undefined) updateData.current_value = data.currentValue;
    if (data.estimatedGrowth !== undefined) updateData.estimated_growth = data.estimatedGrowth ?? undefined;
    
    if (data.currentValue !== undefined || data.estimatedGrowth !== undefined) {
      updateData.last_updated_at = formatTimestamp(new Date());
    }

    const { error } = await supabase
      .from("manual_investments")
      .update(updateData)
      .eq("id", id);

    if (error) {
      logger.error("[InvestmentsRepository] Error updating manual investment:", error);
      throw new Error(`Failed to update manual investment: ${error.message}`);
    }
  }

  /**
   * Delete a manual investment
   */
  async deleteManualInvestment(id: string): Promise<void> {
    const supabase = await createServerClient();

    const { error } = await supabase
      .from("manual_investments")
      .delete()
      .eq("id", id);

    if (error) {
      logger.error("[InvestmentsRepository] Error deleting manual investment:", error);
      throw new Error(`Failed to delete manual investment: ${error.message}`);
    }
  }

  /**
   * Update investment account sync timestamp
   */
  async updateAccountSyncTime(
    accountId: string,
    lastSyncedAt: Date
  ): Promise<void> {
    const supabase = await createServerClient();

    const { error } = await supabase
      .from("investment_accounts")
      .update({
        last_synced_at: formatTimestamp(lastSyncedAt),
        updated_at: formatTimestamp(new Date()),
      })
      .eq("id", accountId);

    if (error) {
      logger.error("[InvestmentsRepository] Error updating account sync time:", error);
      throw new Error(`Failed to update account sync time: ${error.message}`);
    }
  }

  /**
   * Update investment account balance
   */
  async updateAccountBalance(
    accountId: string,
    balance: number
  ): Promise<void> {
    const supabase = await createServerClient();

    const { error } = await supabase
      .from("investment_accounts")
      .update({
        total_equity: balance,
        updated_at: formatTimestamp(new Date()),
      })
      .eq("id", accountId);

    if (error) {
      logger.error("[InvestmentsRepository] Error updating account balance:", error);
      throw new Error(`Failed to update account balance: ${error.message}`);
    }
  }
}

