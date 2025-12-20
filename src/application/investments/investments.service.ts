/**
 * Investments Service
 * Business logic for investments management
 * Note: getHoldings is complex and kept here for now, but could be refactored into a separate calculator
 */

import { InvestmentsRepository } from "@/src/infrastructure/database/repositories/investments.repository";
import { AccountsRepository } from "@/src/infrastructure/database/repositories/accounts.repository";
import { InvestmentsMapper } from "./investments.mapper";
import { InvestmentTransactionFormData, SecurityPriceFormData, InvestmentAccountFormData } from "../../domain/investments/investments.validations";
import { BaseHolding, BaseInvestmentTransaction, BaseSecurity, BaseSecurityPrice } from "../../domain/investments/investments.types";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { formatTimestamp, formatDateOnly } from "@/src/infrastructure/utils/timestamp";
import { mapClassToSector, normalizeAssetType } from "@/lib/utils/portfolio-utils";
import { logger } from "@/src/infrastructure/utils/logger";
import { AppError } from "../shared/app-error";
import { getCurrentUserId } from "../shared/feature-guard";

export class InvestmentsService {
  constructor(
    private repository: InvestmentsRepository,
    private accountsRepository: AccountsRepository
  ) {}

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
    const userId = await getCurrentUserId();
    if (!userId) {
      // In server components, this can happen during SSR - return empty array gracefully
      // Don't log as error since this is expected in some contexts
      return [];
    }

    // Try positions first (faster and more accurate)
    const positions = await this.repository.findPositions(accountId, accessToken, refreshToken);

    if (positions && positions.length > 0) {
      // Fetch securities and accounts for enrichment
      const securityIds = new Set(positions.map(p => p.securityId));
      const accountIds = new Set(positions.map(p => p.accountId));

      const [securities, accounts] = await Promise.all([
        securityIds.size > 0
          ? this.repository.findSecuritiesByIds(Array.from(securityIds), accessToken, refreshToken)
          : Promise.resolve([]),
        accountIds.size > 0
          ? this.accountsRepository.findByIds(Array.from(accountIds), accessToken, refreshToken)
          : Promise.resolve([]),
      ]);

      const securityMap = new Map(securities.map(s => [s.id, s]));
      const accountMap = new Map(accounts.map(a => [a.id, a]));

      const holdings = positions.map(position => {
        const security = securityMap.get(position.securityId);
        const account = accountMap.get(position.accountId);
        return InvestmentsMapper.positionToHolding(position, security || undefined, account || undefined);
      });

      return holdings;
    }

    // Fallback: calculate from transactions (slower but necessary if positions unavailable)
    return await this.calculateHoldingsFromTransactions(accountId, accessToken, refreshToken);
  }

  /**
   * Calculate holdings from transactions (private method)
   * This is used as a fallback when positions are not available
   */
  private async calculateHoldingsFromTransactions(
    accountId?: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<BaseHolding[]> {
    const userId = await getCurrentUserId();
    if (!userId) {
      // In server components, this can happen during SSR - return empty array gracefully
      return [];
    }

    // Get transactions
    const transactions = await this.repository.findTransactions(
      accountId ? { accountId } : undefined,
      accessToken,
      refreshToken
    );

    if (!transactions || transactions.length === 0) {
      return [];
    }

    // Fetch securities and accounts for enrichment
    const securityIds = new Set(transactions.filter(t => t.security_id).map(t => t.security_id!));
    const accountIds = new Set(transactions.map(t => t.account_id));

    const [securities, accounts] = await Promise.all([
      securityIds.size > 0
        ? this.repository.findSecuritiesByIds(Array.from(securityIds), accessToken, refreshToken)
        : Promise.resolve([]),
      accountIds.size > 0
        ? this.accountsRepository.findByIds(Array.from(accountIds), accessToken, refreshToken)
        : Promise.resolve([]),
    ]);

    const securityMap = new Map(securities.map(s => [s.id, s]));
    const accountMap = new Map(accounts.map(a => [a.id, a]));

    // Group by security and account
    const holdingKeyMap = new Map<string, BaseHolding>();

    for (const tx of transactions) {
      if (!tx.security_id || (tx.type !== "buy" && tx.type !== "sell")) {
        continue;
      }

      const security = securityMap.get(tx.security_id);
      const account = accountMap.get(tx.account_id);
      const holdingKey = `${tx.security_id}_${tx.account_id}`;

      if (!holdingKeyMap.has(holdingKey)) {
        const assetType = security?.class || "Stock";
        const sector = security?.sector || mapClassToSector(assetType, security?.symbol || "");

        holdingKeyMap.set(holdingKey, {
          securityId: tx.security_id,
          symbol: security?.symbol || "",
          name: security?.name || security?.symbol || "",
          assetType: normalizeAssetType(assetType),
          sector,
          quantity: 0,
          avgPrice: 0,
          bookValue: 0,
          lastPrice: 0,
          marketValue: 0,
          unrealizedPnL: 0,
          unrealizedPnLPercent: 0,
          accountId: tx.account_id,
          accountName: account?.name || "Unknown Account",
        });
      }

      const holding = holdingKeyMap.get(holdingKey)!;

      if (tx.type === "buy" && tx.quantity && tx.price) {
        const newCost = tx.quantity * tx.price + (tx.fees || 0);
        const totalCost = holding.bookValue + newCost;
        const totalQuantity = holding.quantity + tx.quantity;

        holding.avgPrice = totalQuantity > 0 ? totalCost / totalQuantity : tx.price;
        holding.quantity = totalQuantity;
        holding.bookValue = totalCost;
      } else if (tx.type === "sell" && tx.quantity) {
        holding.quantity = Math.max(0, holding.quantity - tx.quantity);
        const soldCost = tx.quantity * holding.avgPrice;
        holding.bookValue = Math.max(0, holding.bookValue - soldCost);
      }
    }

    // Get latest prices
    const allSecurityIds = Array.from(new Set(Array.from(holdingKeyMap.values()).map(h => h.securityId)));
    if (allSecurityIds.length > 0) {
      const supabase = await createServerClient(accessToken, refreshToken);
      const { data: prices } = await supabase
        .from("security_prices")
        .select("securityId, price, date")
        .in("securityId", allSecurityIds)
        .order("securityId", { ascending: true })
        .order("date", { ascending: false });

      const priceMap = new Map<string, number>();
      if (prices) {
        for (const price of prices) {
          if (!priceMap.has(price.securityId)) {
            priceMap.set(price.securityId, price.price);
          }
        }
      }

      // Apply prices to holdings
      for (const holding of holdingKeyMap.values()) {
        const latestPrice = priceMap.get(holding.securityId);
        if (latestPrice && latestPrice > 0) {
          holding.lastPrice = latestPrice;
          holding.marketValue = holding.quantity * latestPrice;
          holding.unrealizedPnL = holding.marketValue - holding.bookValue;
          holding.unrealizedPnLPercent = holding.bookValue > 0 
            ? (holding.unrealizedPnL / holding.bookValue) * 100 
            : 0;
        } else if (holding.avgPrice > 0) {
          holding.lastPrice = holding.avgPrice;
          holding.marketValue = holding.quantity * holding.avgPrice;
          holding.unrealizedPnL = 0;
          holding.unrealizedPnLPercent = 0;
        }
      }
    }

    // Filter out zero quantity holdings
    return Array.from(holdingKeyMap.values()).filter((h) => h.quantity > 0);
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
   * Get total investments value (simple investments)
   * Calculates total value from SimpleInvestmentEntry and AccountInvestmentValue
   */
  async getTotalInvestmentsValue(): Promise<number> {
    const userId = await getCurrentUserId();
    if (!userId) {
      return 0;
    }

    const supabase = await createServerClient();

    // Get all investment accounts (type = "investment")
    const { data: investmentAccounts, error: accountsError } = await supabase
      .from("accounts")
      .select("id")
      .eq("type", "investment");

    if (accountsError || !investmentAccounts || investmentAccounts.length === 0) {
      // Handle permission denied errors gracefully
      if (accountsError?.code === '42501' || accountsError?.message?.includes('permission denied')) {
        logger.warn("[InvestmentsService] Permission denied fetching investment accounts - user may not be authenticated");
        return 0;
      }
      return 0;
    }

    const accountIds = investmentAccounts.map((acc) => acc.id);

    // Get stored values for these accounts
    const { data: storedValues, error: valuesError } = await supabase
      .from("account_investment_values")
      .select("accountId, totalValue")
      .in("accountId", accountIds);

    // Get all entries for these accounts
    const { data: entries, error: entriesError } = await supabase
      .from("simple_investment_entries")
      .select("accountId, type, amount")
      .in("accountId", accountIds);

    // Calculate total value for each account
    let totalValue = 0;

    for (const account of investmentAccounts) {
      const storedValue = storedValues?.find((v) => v.accountId === account.id);
      
      if (storedValue) {
        // Use stored value if available
        totalValue += storedValue.totalValue;
      } else {
        // Calculate from entries if no stored value
        const accountEntries = entries?.filter((e) => e.accountId === account.id) || [];
        const accountTotal = accountEntries.reduce((sum, entry) => {
          // All entry types contribute to the total value
          if (entry.type === "initial" || entry.type === "contribution") {
            return sum + entry.amount;
          } else if (entry.type === "dividend" || entry.type === "interest") {
            return sum + entry.amount;
          }
          return sum;
        }, 0);
        totalValue += accountTotal;
      }
    }

    return totalValue;
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
    const transactions = await this.repository.findTransactions(filters);

    // Fetch relations
    const securityIds = new Set(transactions.filter(t => t.security_id).map(t => t.security_id!));
    const accountIds = new Set(transactions.map(t => t.account_id));

    const [securities, accounts] = await Promise.all([
      securityIds.size > 0
        ? this.repository.findSecuritiesByIds(Array.from(securityIds))
        : Promise.resolve([]),
      accountIds.size > 0
        ? this.accountsRepository.findByIds(Array.from(accountIds))
        : Promise.resolve([]),
    ]);

    const securityMap = new Map(securities.map(s => [s.id, s]));
    const accountMap = new Map(accounts.map(a => [a.id, a]));

    return transactions.map(tx => {
      return InvestmentsMapper.transactionToDomain(tx, {
        security: tx.security_id ? (securityMap.get(tx.security_id) || null) : null,
        account: accountMap.get(tx.account_id) || null,
      });
    });
  }

  /**
   * Create investment transaction
   */
  async createInvestmentTransaction(data: InvestmentTransactionFormData): Promise<BaseInvestmentTransaction> {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new AppError("Unauthorized", 401);
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


    // Fetch relations
    const relations = await this.fetchTransactionRelations(transactionRow);

    return InvestmentsMapper.transactionToDomain(transactionRow, relations);
  }

  /**
   * Update investment transaction
   */
  async updateInvestmentTransaction(
    id: string,
    data: Partial<InvestmentTransactionFormData>
  ): Promise<BaseInvestmentTransaction> {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    const updateData: Partial<{
      date: string;
      type: string;
      quantity: number | null;
      price: number | null;
      fees: number;
      notes: string | null;
      securityId: string | null;
      accountId: string;
    }> = {};
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


    // Fetch relations
    const relations = await this.fetchTransactionRelations(updatedRow);

    return InvestmentsMapper.transactionToDomain(updatedRow, relations);
  }

  /**
   * Delete investment transaction
   */
  async deleteInvestmentTransaction(id: string): Promise<void> {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    await this.repository.deleteTransaction(id);

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
    const securityIds = new Set(prices.map(p => p.security_id));
    const supabase = await createServerClient();
    const { data: securities } = await supabase
      .from("securities")
      .select("*")
      .in("id", Array.from(securityIds));

    const securityMap = new Map((securities || []).map(s => [s.id, InvestmentsMapper.securityToDomain(s)]));

    return prices.map((price) => {
      return InvestmentsMapper.securityPriceToDomain(price, securityMap.get(price.security_id));
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
      .from("securities")
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
    try {
      const accounts = await this.repository.findInvestmentAccounts(accessToken, refreshToken);
      return accounts.map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        userId: a.user_id,
        householdId: a.household_id,
        createdAt: new Date(a.created_at),
        updatedAt: new Date(a.updated_at),
      }));
    } catch (error: any) {
      // Handle permission denied errors gracefully (can happen during SSR)
      if (error?.code === '42501' || error?.message?.includes('permission denied')) {
        logger.warn("[InvestmentsService] Permission denied fetching investment accounts - user may not be authenticated");
        return [];
      }
      throw error;
    }
  }

  /**
   * Create investment account
   */
  async createInvestmentAccount(data: InvestmentAccountFormData, accessToken?: string, refreshToken?: string): Promise<{ id: string; name: string; type: string; userId: string; householdId: string | null; createdAt: Date | string; updatedAt: Date | string }> {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    const id = crypto.randomUUID();
    const now = formatTimestamp(new Date());

    const supabase = await createServerClient(accessToken, refreshToken);

    // Create account in Account table with type "investment"
    const { data: account, error } = await supabase
      .from("accounts")
      .insert({
        id,
        name: data.name,
        type: "investment",
        userId,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single();

    if (error) {
      logger.error("[InvestmentsService] Error creating investment account:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new AppError(`Failed to create investment account: ${errorMessage}`, 500);
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
    transaction: any
  ): Promise<{
    account?: { id: string; name: string; type: string } | null;
    security?: { id: string; symbol: string; name: string; class: string; sector: string | null } | null;
  }> {
    const relations: any = {};

    if (transaction.accountId) {
      const account = await this.accountsRepository.findById(transaction.accountId);
      relations.account = account ? { id: account.id, name: account.name, type: account.type } : null;
    }

    if (transaction.security_id) {
      const securities = await this.repository.findSecuritiesByIds([transaction.security_id]);
      const security = securities[0] || null;
      relations.security = security ? { id: security.id, symbol: security.symbol, name: security.name, class: security.class, sector: security.sector } : null;
    }

    return relations;
  }

  /**
   * Market Prices Methods
   */

  /**
   * Fetch real-time price from Yahoo Finance API
   */
  private async fetchYahooFinancePrice(symbol: string): Promise<number | null> {
    try {
      let normalizedSymbol = symbol.toUpperCase();
      
      const cryptoPattern = /^(BTC|ETH|BNB|ADA|SOL|XRP|DOT|DOGE|AVAX|MATIC|LINK|UNI|LTC|ALGO|ATOM|VET|FIL|TRX|EOS|XLM|AAVE|MKR|COMP|SUSHI|CRV|YFI|SNX|GRT|ENJ|MANA|SAND|AXS|CHZ|FLOW|NEAR|FTM|ONE|HBAR|ICP|THETA|ZIL|ZEC|DASH|XMR|BCH|BSV|ETC|ZEC)$/i;
      if (cryptoPattern.test(normalizedSymbol) && !normalizedSymbol.includes('-')) {
        normalizedSymbol = `${normalizedSymbol}-USD`;
      }
      
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${normalizedSymbol}?interval=1d&range=1d`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
        next: { revalidate: 60 },
      }).catch((error) => {
        logger.error(`Network error fetching price for ${symbol}:`, error);
        return null;
      });

      if (!response || !response.ok) {
        logger.error(`Failed to fetch price for ${symbol}: ${response?.statusText || 'Network error'}`);
        return null;
      }

      const data = await response.json();
      
      if (data?.chart?.error || !data?.chart?.result?.[0]) {
        return null;
      }

      const result = data.chart.result[0];
      const meta = result.meta;
      
      if (!meta) {
        return null;
      }

      return meta.regularMarketPrice || meta.currentPrice || meta.previousClose || null;
    } catch (error) {
      logger.error(`Error fetching price for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Get logo URL for a security symbol
   */
  private getSecurityLogoUrl(symbol: string, securityClass: "stock" | "etf" | "crypto" | "bond" | "reit"): string {
    const normalizedSymbol = symbol.toUpperCase();
    
    if (securityClass === "crypto") {
      return `https://cryptoicons.org/api/icon/${normalizedSymbol.toLowerCase()}/200`;
    }
    
    return `https://assets.polygon.io/logos/${normalizedSymbol}/logo.png`;
  }

  /**
   * Update prices for all securities in the database
   */
  async updateAllSecurityPrices(): Promise<{ updated: number; errors: string[] }> {
    const supabase = await createServerClient();
    const now = formatTimestamp(new Date());
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = formatTimestamp(today);

    // Get all securities
    const { data: securities, error: securitiesError } = await supabase
      .from("securities")
      .select("id, symbol");

    if (securitiesError || !securities || securities.length === 0) {
      return { updated: 0, errors: [securitiesError?.message || "No securities found"] };
    }

    // Fetch prices in parallel
    const pricePromises = securities.map(async (security) => {
      const price = await this.fetchYahooFinancePrice(security.symbol);
      return { securityId: security.id, symbol: security.symbol, price };
    });

    const priceResults = await Promise.all(pricePromises);
    const priceMap = new Map<string, number>();
    const errors: string[] = [];

    for (const result of priceResults) {
      if (result.price === null || result.price === undefined) {
        errors.push(`${result.symbol}: No price found`);
        continue;
      }
      
      if (result.price <= 0) {
        errors.push(`${result.symbol}: Invalid price (${result.price})`);
        continue;
      }

      priceMap.set(result.securityId, result.price);
    }

    // Update prices for each security
    let updated = 0;
    for (const security of securities) {
      const price = priceMap.get(security.id);
      
      if (price === undefined || price === null) {
        continue;
      }

      // Check if price already exists for today
      const { data: existingPrice } = await supabase
        .from("security_prices")
        .select("id, price")
        .eq("securityId", security.id)
        .eq("date", todayTimestamp)
        .single();

      if (existingPrice) {
        const priceDifference = Math.abs(existingPrice.price - price);
        const priceChangePercent = (priceDifference / existingPrice.price) * 100;
        
        if (priceChangePercent > 0.01) {
          const { error: updateError } = await supabase
            .from("security_prices")
            .update({ price })
            .eq("id", existingPrice.id);

          if (updateError) {
            errors.push(`Failed to update price for ${security.symbol}: ${updateError.message}`);
          } else {
            updated++;
          }
        }
      } else {
        const id = crypto.randomUUID();
        const { error: insertError } = await supabase
          .from("security_prices")
          .insert({
            id,
            securityId: security.id,
            date: todayTimestamp,
            price,
            createdAt: now,
          });

        if (insertError) {
          errors.push(`Failed to create price for ${security.symbol}: ${insertError.message}`);
        } else {
          updated++;
        }
      }
    }

    return { updated, errors };
  }

  /**
   * Search for security information by symbol using Yahoo Finance API
   */
  async searchSecurityBySymbol(symbol: string): Promise<{
    symbol: string;
    name: string;
    class: "stock" | "etf" | "crypto" | "bond" | "reit";
    price?: number;
    currency?: string;
    exchange?: string;
    logo?: string;
  } | null> {
    try {
      let normalizedSymbol = symbol.toUpperCase().trim();
      
      const cryptoPattern = /^(BTC|ETH|BNB|ADA|SOL|XRP|DOT|DOGE|AVAX|MATIC|LINK|UNI|LTC|ALGO|ATOM|VET|FIL|TRX|EOS|XLM|AAVE|MKR|COMP|SUSHI|CRV|YFI|SNX|GRT|ENJ|MANA|SAND|AXS|CHZ|FLOW|NEAR|FTM|ONE|HBAR|ICP|THETA|ZIL|ZEC|DASH|XMR|BCH|BSV|ETC|ZEC)$/i;
      const isCrypto = cryptoPattern.test(normalizedSymbol) && !normalizedSymbol.includes('-');
      if (isCrypto) {
        normalizedSymbol = `${normalizedSymbol}-USD`;
      }
      
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${normalizedSymbol}?interval=1d&range=1d`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
        next: { revalidate: 300 },
      }).catch((error) => {
        logger.error(`Network error fetching security info for ${symbol}:`, error);
        return null;
      });

      if (!response || !response.ok) {
        return null;
      }

      const data = await response.json();
      
      if (data?.chart?.error || !data?.chart?.result?.[0]) {
        return null;
      }
      
      const result = data.chart.result[0];
      const meta = result.meta;
      
      if (!meta) {
        return null;
      }

      let securityClass: "stock" | "etf" | "crypto" | "bond" | "reit" = "stock";
      
      if (isCrypto) {
        securityClass = "crypto";
      } else {
        const quoteType = meta.quoteType?.toLowerCase() || "";
        const longName = meta.longName?.toLowerCase() || "";
        const shortName = meta.shortName?.toLowerCase() || "";
        
        if (quoteType === "etf" || longName.includes("etf") || shortName.includes("etf")) {
          securityClass = "etf";
        } else if (quoteType === "bond" || longName.includes("bond") || shortName.includes("bond")) {
          securityClass = "bond";
        } else if (quoteType === "equity" && (longName.includes("reit") || shortName.includes("reit"))) {
          securityClass = "reit";
        }
      }

      const price = meta.regularMarketPrice || meta.currentPrice || meta.previousClose || undefined;
      const finalSymbol = normalizedSymbol.includes('-USD') ? normalizedSymbol.split('-')[0] : normalizedSymbol;
      
      return {
        symbol: finalSymbol,
        name: meta.longName || meta.shortName || normalizedSymbol,
        class: securityClass,
        price,
        currency: meta.currency || "USD",
        exchange: meta.exchangeName || meta.fullExchangeName || undefined,
        logo: this.getSecurityLogoUrl(finalSymbol, securityClass),
      };
    } catch (error) {
      logger.error(`Error searching security for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Search for securities by name or symbol using Yahoo Finance autocomplete API
   */
  async searchSecuritiesByName(query: string): Promise<Array<{
    symbol: string;
    name: string;
    class: "stock" | "etf" | "crypto" | "bond" | "reit";
    exchange?: string;
    type?: string;
    logo?: string;
  }>> {
    try {
      if (!query || query.trim() === "") {
        return [];
      }

      const searchQuery = query.trim();
      const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(searchQuery)}&quotesCount=10&newsCount=0`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
        next: { revalidate: 300 },
      }).catch((error) => {
        logger.error(`Network error searching securities for ${searchQuery}:`, error);
        return null;
      });

      if (!response || !response.ok) {
        return [];
      }

      const data = await response.json();
      
      if (!data?.quotes || !Array.isArray(data.quotes)) {
        return [];
      }

      const results: Array<{
        symbol: string;
        name: string;
        class: "stock" | "etf" | "crypto" | "bond" | "reit";
        exchange?: string;
        type?: string;
        logo?: string;
      }> = [];

      for (const quote of data.quotes) {
        if (!quote.symbol || !quote.shortname) {
          continue;
        }

        let securityClass: "stock" | "etf" | "crypto" | "bond" | "reit" = "stock";
        
        const quoteType = quote.quoteType?.toLowerCase() || "";
        const longName = quote.longname?.toLowerCase() || "";
        const shortName = quote.shortname?.toLowerCase() || "";
        const symbol = quote.symbol.toUpperCase();
        
        const cryptoPattern = /^(BTC|ETH|BNB|ADA|SOL|XRP|DOT|DOGE|AVAX|MATIC|LINK|UNI|LTC|ALGO|ATOM|VET|FIL|TRX|EOS|XLM|AAVE|MKR|COMP|SUSHI|CRV|YFI|SNX|GRT|ENJ|MANA|SAND|AXS|CHZ|FLOW|NEAR|FTM|ONE|HBAR|ICP|THETA|ZIL|ZEC|DASH|XMR|BCH|BSV|ETC|ZEC)-USD$/i;
        if (cryptoPattern.test(symbol) || symbol.endsWith("-USD")) {
          securityClass = "crypto";
        } else if (quoteType === "etf" || longName.includes("etf") || shortName.includes("etf")) {
          securityClass = "etf";
        } else if (quoteType === "bond" || longName.includes("bond") || shortName.includes("bond")) {
          securityClass = "bond";
        } else if (quoteType === "equity" && (longName.includes("reit") || shortName.includes("reit"))) {
          securityClass = "reit";
        }

        const normalizedSymbolForLogo = symbol.replace("-USD", "");
        
        results.push({
          symbol: normalizedSymbolForLogo,
          name: quote.longname || quote.shortname || quote.symbol,
          class: securityClass,
          exchange: quote.exchange || quote.exchangeDisp,
          type: quote.quoteType,
          logo: this.getSecurityLogoUrl(normalizedSymbolForLogo, securityClass),
        });
      }

      return results;
    } catch (error) {
      logger.error(`Error searching securities for ${query}:`, error);
      return [];
    }
  }

  /**
   * Simple Investments Methods
   */

  /**
   * Get simple investment entries
   */
  async getSimpleInvestmentEntries(accountId?: string): Promise<Array<{
    id: string;
    accountId: string;
    date: string;
    type: "contribution" | "dividend" | "interest" | "initial";
    amount: number;
    description?: string | null;
    createdAt: string;
    updatedAt: string;
  }>> {
    const supabase = await createServerClient();

    let query = supabase
      .from("simple_investment_entries")
      .select("*")
      .order("date", { ascending: false });

    if (accountId) {
      query = query.eq("account_id", accountId);
    }

    const { data, error } = await query;

    if (error) {
      logger.error("Error fetching simple investment entries:", error);
      return [];
    }

    return (data || []) as Array<{
      id: string;
      accountId: string;
      date: string;
      type: "contribution" | "dividend" | "interest" | "initial";
      amount: number;
      description?: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
  }

  /**
   * Create simple investment entry
   */
  async createSimpleInvestmentEntry(data: {
    accountId: string;
    date: Date;
    type: "contribution" | "dividend" | "interest" | "initial";
    amount: number;
    description?: string;
  }): Promise<{
    id: string;
    accountId: string;
    date: string;
    type: "contribution" | "dividend" | "interest" | "initial";
    amount: number;
    description?: string | null;
    createdAt: string;
    updatedAt: string;
  }> {
    const supabase = await createServerClient();
    const id = crypto.randomUUID();
    const date = data.date instanceof Date ? data.date : new Date(data.date);
    const entryDate = formatTimestamp(date);
    const now = formatTimestamp(new Date());

    const { data: entry, error } = await supabase
      .from("simple_investment_entries")
      .insert({
        id,
        accountId: data.accountId,
        date: entryDate,
        type: data.type,
        amount: data.amount,
        description: data.description || null,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single();

    if (error) {
      logger.error("Error creating simple investment entry:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new AppError(
        `Failed to create investment entry: ${errorMessage || JSON.stringify(error)}`,
        500
      );
    }

    return entry;
  }

  /**
   * Get account investment value
   */
  async getAccountInvestmentValue(accountId: string): Promise<{
    id: string;
    accountId: string;
    totalValue: number;
    updatedAt: string;
  } | null> {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("account_investment_values")
      .select("*")
      .eq("account_id", accountId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      logger.error("Error fetching account investment value:", error);
      return null;
    }

    return data as {
      id: string;
      accountId: string;
      totalValue: number;
      updatedAt: string;
    } | null;
  }

  /**
   * Upsert account investment value
   */
  async upsertAccountInvestmentValue(data: {
    accountId: string;
    totalValue: number;
  }): Promise<{
    id: string;
    accountId: string;
    totalValue: number;
    updatedAt: string;
  }> {
    const supabase = await createServerClient();
    const now = formatTimestamp(new Date());

    const existing = await this.getAccountInvestmentValue(data.accountId);

    if (existing) {
      const { data: updated, error } = await supabase
        .from("account_investment_values")
        .update({
          totalValue: data.totalValue,
          updatedAt: now,
        })
        .eq("account_id", data.accountId)
        .select()
        .single();

      if (error) {
        logger.error("Error updating account investment value:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new AppError(
          `Failed to update investment value: ${errorMessage || JSON.stringify(error)}`,
          500
        );
      }

      return updated;
    } else {
      const id = crypto.randomUUID();
      const { data: created, error } = await supabase
        .from("account_investment_values")
        .insert({
          id,
          accountId: data.accountId,
          totalValue: data.totalValue,
          createdAt: now,
          updatedAt: now,
        })
        .select()
        .single();

      if (error) {
        logger.error("Error creating account investment value:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new AppError(
          `Failed to create investment value: ${errorMessage || JSON.stringify(error)}`,
          500
        );
      }

      return created;
    }
  }
}

