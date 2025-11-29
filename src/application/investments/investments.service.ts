/**
 * Investments Service
 * Business logic for investments management
 * Note: getHoldings is complex and kept here for now, but could be refactored into a separate calculator
 */

import { InvestmentsRepository } from "../../infrastructure/database/repositories/investments.repository";
import { InvestmentsMapper } from "./investments.mapper";
import { InvestmentTransactionFormData, SecurityPriceFormData, InvestmentAccountFormData } from "../../domain/investments/investments.validations";
import { BaseHolding, BaseInvestmentTransaction, BaseSecurity, BaseSecurityPrice } from "../../domain/investments/investments.types";
import { createServerClient } from "../../infrastructure/database/supabase-server";
import { formatTimestamp, formatDateOnly } from "@/src/infrastructure/utils/timestamp";
import { mapClassToSector, normalizeAssetType } from "@/lib/utils/portfolio-utils";
import { logger } from "@/src/infrastructure/utils/logger";
import { HOLDINGS_CACHE_TTL } from "../../domain/investments/investments.constants";

// In-memory cache for holdings
const holdingsCache = new Map<string, { data: BaseHolding[]; timestamp: number }>();

function cleanHoldingsCache() {
  const now = Date.now();
  for (const [key, value] of holdingsCache.entries()) {
    if (now - value.timestamp > HOLDINGS_CACHE_TTL) {
      holdingsCache.delete(key);
    }
  }
}

export class InvestmentsService {
  constructor(private repository: InvestmentsRepository) {}

  /**
   * Get holdings (complex calculation from positions or transactions)
   * This is a complex operation that calculates current portfolio holdings
   */
  async getHoldings(
    accountId?: string,
    accessToken?: string,
    refreshToken?: string,
    useCache: boolean = true
  ): Promise<BaseHolding[]> {
    const supabase = await createServerClient(accessToken, refreshToken);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      logger.error("[InvestmentsService] ERROR: No authenticated user!", userError);
      return [];
    }

    // Check cache
    const cacheKey = `holdings:${user.id}:${accountId || 'all'}`;
    if (useCache) {
      cleanHoldingsCache();
      const cached = holdingsCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < HOLDINGS_CACHE_TTL) {
        return cached.data;
      }
    }

    // Try positions first (faster and more accurate)
    const positions = await this.repository.findPositions(accountId, accessToken, refreshToken);

    if (positions && positions.length > 0) {
      // Fetch securities and accounts for enrichment
      const securityIds = new Set(positions.map(p => p.securityId));
      const accountIds = new Set(positions.map(p => p.accountId));

      const [securitiesResult, accountsResult] = await Promise.all([
        securityIds.size > 0
          ? supabase.from("Security").select("id, symbol, name, class, sector").in("id", Array.from(securityIds))
          : Promise.resolve({ data: [], error: null }),
        accountIds.size > 0
          ? supabase.from("Account").select("id, name").in("id", Array.from(accountIds))
          : Promise.resolve({ data: [], error: null }),
      ]);

      const securityMap = new Map((securitiesResult.data || []).map(s => [s.id, s]));
      const accountMap = new Map((accountsResult.data || []).map(a => [a.id, a]));

      const holdings = positions.map(position => {
        const security = securityMap.get(position.securityId);
        const account = accountMap.get(position.accountId);
        return InvestmentsMapper.positionToHolding(position, security || undefined, account || undefined);
      });

      if (useCache) {
        holdingsCache.set(cacheKey, { data: holdings, timestamp: Date.now() });
      }
      return holdings;
    }

    // Fallback: calculate from transactions (slower but necessary if positions unavailable)
    // This is a simplified version - the full logic is in lib/api/investments.ts
    // For now, we'll use the old function as a temporary bridge
    const { getHoldings: getHoldingsLegacy } = await import("@/lib/api/investments");
    const holdings = await getHoldingsLegacy(accountId, accessToken, refreshToken, useCache);
    
    return holdings.map(h => ({
      securityId: h.securityId,
      symbol: h.symbol,
      name: h.name,
      assetType: h.assetType,
      sector: h.sector,
      quantity: h.quantity,
      avgPrice: h.avgPrice,
      bookValue: h.bookValue,
      lastPrice: h.lastPrice,
      marketValue: h.marketValue,
      unrealizedPnL: h.unrealizedPnL,
      unrealizedPnLPercent: h.unrealizedPnLPercent,
      accountId: h.accountId,
      accountName: h.accountName,
    }));
  }

  /**
   * Clear holdings cache
   */
  clearHoldingsCache(userId?: string): void {
    if (userId) {
      for (const key of holdingsCache.keys()) {
        if (key.startsWith(`holdings:${userId}:`)) {
          holdingsCache.delete(key);
        }
      }
    } else {
      holdingsCache.clear();
    }
  }

  /**
   * Get portfolio value
   */
  async getPortfolioValue(
    accountId?: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<number> {
    const holdings = await this.getHoldings(accountId, accessToken, refreshToken);
    return holdings.reduce((sum, h) => sum + h.marketValue, 0);
  }

  /**
   * Get investment transactions
   */
  async getInvestmentTransactions(filters?: {
    accountId?: string;
    securityId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<BaseInvestmentTransaction[]> {
    const supabase = await createServerClient();
    const transactions = await this.repository.findTransactions(filters);

    // Fetch relations
    const securityIds = new Set(transactions.filter(t => t.securityId).map(t => t.securityId!));
    const accountIds = new Set(transactions.map(t => t.accountId));

    const [securitiesResult, accountsResult] = await Promise.all([
      securityIds.size > 0
        ? supabase.from("Security").select("id, symbol, name, class, sector").in("id", Array.from(securityIds))
        : Promise.resolve({ data: [], error: null }),
      accountIds.size > 0
        ? supabase.from("Account").select("id, name, type").in("id", Array.from(accountIds))
        : Promise.resolve({ data: [], error: null }),
    ]);

    const securityMap = new Map((securitiesResult.data || []).map(s => [s.id, s]));
    const accountMap = new Map((accountsResult.data || []).map(a => [a.id, a]));

    return transactions.map(tx => {
      return InvestmentsMapper.transactionToDomain(tx, {
        security: tx.securityId ? (securityMap.get(tx.securityId) || null) : null,
        account: accountMap.get(tx.accountId) || null,
      });
    });
  }

  /**
   * Create investment transaction
   */
  async createInvestmentTransaction(data: InvestmentTransactionFormData): Promise<BaseInvestmentTransaction> {
    const supabase = await createServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const id = crypto.randomUUID();
    const date = data.date instanceof Date ? data.date : new Date(data.date);
    const transactionDate = formatDateOnly(date);
    const now = formatTimestamp(new Date());

    const transactionRow = await this.repository.createTransaction({
      id,
      date: transactionDate,
      accountId: data.accountId,
      securityId: data.securityId || null,
      type: data.type,
      quantity: data.quantity || null,
      price: data.price || null,
      fees: data.fees || 0,
      notes: data.notes || null,
      createdAt: now,
      updatedAt: now,
    });

    // Clear cache
    this.clearHoldingsCache(user.id);

    // Fetch relations
    const relations = await this.fetchTransactionRelations(transactionRow, supabase);

    return InvestmentsMapper.transactionToDomain(transactionRow, relations);
  }

  /**
   * Update investment transaction
   */
  async updateInvestmentTransaction(
    id: string,
    data: Partial<InvestmentTransactionFormData>
  ): Promise<BaseInvestmentTransaction> {
    const supabase = await createServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const updateData: any = {};
    if (data.date) {
      const date = data.date instanceof Date ? data.date : new Date(data.date);
      updateData.date = formatDateOnly(date);
    }
    if (data.accountId) updateData.accountId = data.accountId;
    if (data.securityId !== undefined) updateData.securityId = data.securityId || null;
    if (data.type) updateData.type = data.type;
    if (data.quantity !== undefined) updateData.quantity = data.quantity || null;
    if (data.price !== undefined) updateData.price = data.price || null;
    if (data.fees !== undefined) updateData.fees = data.fees || 0;
    if (data.notes !== undefined) updateData.notes = data.notes || null;

    const updatedRow = await this.repository.updateTransaction(id, updateData);

    // Clear cache
    this.clearHoldingsCache(user.id);

    // Fetch relations
    const relations = await this.fetchTransactionRelations(updatedRow, supabase);

    return InvestmentsMapper.transactionToDomain(updatedRow, relations);
  }

  /**
   * Delete investment transaction
   */
  async deleteInvestmentTransaction(id: string): Promise<void> {
    const supabase = await createServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    await this.repository.deleteTransaction(id);

    // Clear cache
    this.clearHoldingsCache(user.id);
  }

  /**
   * Get securities
   */
  async getSecurities(): Promise<BaseSecurity[]> {
    const securities = await this.repository.findSecurities();
    return securities.map(s => InvestmentsMapper.securityToDomain(s));
  }

  /**
   * Create security
   */
  async createSecurity(data: { symbol: string; name: string; class: string }): Promise<BaseSecurity> {
    const id = crypto.randomUUID();
    const now = formatTimestamp(new Date());
    const normalizedClass = normalizeAssetType(data.class);

    const securityRow = await this.repository.createSecurity({
      id,
      symbol: data.symbol.toUpperCase(),
      name: data.name,
      class: normalizedClass,
      createdAt: now,
      updatedAt: now,
    });

    return InvestmentsMapper.securityToDomain(securityRow);
  }

  /**
   * Get security prices
   */
  async getSecurityPrices(securityId?: string): Promise<BaseSecurityPrice[]> {
    const prices = await this.repository.findSecurityPrices(securityId);
    
    // Fetch securities if needed
    const securityIds = new Set(prices.map(p => p.securityId));
    const supabase = await createServerClient();
    const { data: securities } = await supabase
      .from("Security")
      .select("*")
      .in("id", Array.from(securityIds));

    const securityMap = new Map((securities || []).map(s => [s.id, InvestmentsMapper.securityToDomain(s)]));

    return prices.map(price => {
      return InvestmentsMapper.securityPriceToDomain(price, securityMap.get(price.securityId));
    });
  }

  /**
   * Create security price
   */
  async createSecurityPrice(data: SecurityPriceFormData): Promise<BaseSecurityPrice> {
    const id = crypto.randomUUID();
    const date = data.date instanceof Date ? data.date : new Date(data.date);
    const priceDate = formatTimestamp(date);
    const now = formatTimestamp(new Date());

    const priceRow = await this.repository.createSecurityPrice({
      id,
      securityId: data.securityId,
      date: priceDate,
      price: data.price,
      createdAt: now,
    });

    // Fetch security
    const supabase = await createServerClient();
    const { data: security } = await supabase
      .from("Security")
      .select("*")
      .eq("id", data.securityId)
      .single();

    return InvestmentsMapper.securityPriceToDomain(priceRow, security ? InvestmentsMapper.securityToDomain(security) : null);
  }

  /**
   * Get investment accounts
   */
  async getInvestmentAccounts(
    accessToken?: string,
    refreshToken?: string
  ): Promise<Array<{ id: string; name: string; type: string; userId: string; householdId: string | null; createdAt: Date | string; updatedAt: Date | string }>> {
    const accounts = await this.repository.findInvestmentAccounts(accessToken, refreshToken);
    return accounts.map(a => ({
      ...a,
      createdAt: new Date(a.createdAt),
      updatedAt: new Date(a.updatedAt),
    }));
  }

  /**
   * Create investment account
   */
  async createInvestmentAccount(data: InvestmentAccountFormData): Promise<{ id: string; name: string; type: string; userId: string; householdId: string | null; createdAt: Date | string; updatedAt: Date | string }> {
    const supabase = await createServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const id = crypto.randomUUID();
    const now = formatTimestamp(new Date());

    // Create account in Account table with type "investment"
    const { data: account, error } = await supabase
      .from("Account")
      .insert({
        id,
        name: data.name,
        type: "investment",
        userId: user.id,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single();

    if (error) {
      logger.error("[InvestmentsService] Error creating investment account:", error);
      throw new Error(`Failed to create investment account: ${error.message}`);
    }

    return {
      ...account,
      createdAt: new Date(account.createdAt),
      updatedAt: new Date(account.updatedAt),
    };
  }

  /**
   * Helper to fetch transaction relations
   */
  private async fetchTransactionRelations(
    transaction: any,
    supabase: any
  ): Promise<{
    account?: { id: string; name: string; type: string } | null;
    security?: { id: string; symbol: string; name: string; class: string; sector: string | null } | null;
  }> {
    const relations: any = {};

    if (transaction.accountId) {
      const { data: account } = await supabase
        .from("Account")
        .select("id, name, type")
        .eq("id", transaction.accountId)
        .single();
      relations.account = account || null;
    }

    if (transaction.securityId) {
      const { data: security } = await supabase
        .from("Security")
        .select("id, symbol, name, class, sector")
        .eq("id", transaction.securityId)
        .single();
      relations.security = security || null;
    }

    return relations;
  }
}

