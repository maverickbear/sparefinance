"use server";

import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { InvestmentTransactionFormData, SecurityPriceFormData, InvestmentAccountFormData } from "@/src/domain/investments/investments.validations";
import { formatTimestamp, formatDateStart, formatDateEnd, formatDateOnly } from "@/src/infrastructure/utils/timestamp";
import { mapClassToSector, normalizeAssetType } from "@/lib/utils/portfolio-utils";
import { logger } from "@/src/infrastructure/utils/logger";

// In-memory cache for holdings to avoid duplicate calculations within the same request
// This cache is request-scoped and helps reduce duplicate calls
const holdingsCache = new Map<string, { data: Holding[], timestamp: number }>();
const HOLDINGS_CACHE_TTL = 30000; // 30 seconds

// Clear old cache entries periodically
function cleanHoldingsCache() {
  const now = Date.now();
  for (const [key, value] of holdingsCache.entries()) {
    if (now - value.timestamp > HOLDINGS_CACHE_TTL) {
      holdingsCache.delete(key);
    }
  }
}

export interface Holding {
  securityId: string;
  symbol: string;
  name: string;
  assetType: string;
  sector: string;
  quantity: number;
  avgPrice: number;
  bookValue: number;
  lastPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  accountId: string;
  accountName: string;
}

export async function getHoldings(
  accountId?: string, 
  accessToken?: string, 
  refreshToken?: string,
  useCache: boolean = true
): Promise<Holding[]> {
  const supabase = await createServerClient(accessToken, refreshToken);
  const log = logger.withPrefix("INVESTMENTS");

  // Verify user context
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    logger.error("[getHoldings] ERROR: No authenticated user!", userError);
    return [];
  }

  // Check in-memory cache first (helps avoid duplicate calls in same request)
  const cacheKey = `holdings:${user.id}:${accountId || 'all'}`;
  if (useCache) {
    cleanHoldingsCache();
    const cached = holdingsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < HOLDINGS_CACHE_TTL) {
      logger.log("[getHoldings] Using cached data for user:", user.id, accountId ? `(account: ${accountId})` : "(all accounts)");
      return cached.data;
    }
  }

  logger.log("[getHoldings] Called for user:", user.id, accountId ? `(account: ${accountId})` : "(all accounts)");

  // NOTE: Materialized view (holdings_view) is disabled because it calculates
  // book_value incorrectly for sell transactions (uses sell price instead of avg cost).
  // We use positions when available, or calculate from transactions (correct).
  // See: docs/ANALISE_PORTFOLIO_CALCULOS.md for details.

  // First, try to get holdings from positions (more accurate and faster)
  // OPTIMIZED: Select only necessary fields instead of * to reduce payload size
  const { data: positions, error: positionsError } = await supabase
    .from("Position")
    .select(`
      securityId,
      accountId,
      openQuantity,
      averageEntryPrice,
      totalCost,
      currentPrice,
      currentMarketValue,
      openPnl,
      lastUpdatedAt,
      security:Security(id, symbol, name, class, sector),
      account:InvestmentAccount(id, name)
    `)
    .gt("openQuantity", 0)
    .order("lastUpdatedAt", { ascending: false });
  
  logger.log("[getHoldings] Positions:", positions?.length || 0, positionsError ? `(error: ${positionsError.message})` : "");

  if (!positionsError && positions && positions.length > 0) {
    // Positions found - use them directly
    
    // Filter by accountId if provided
    let filteredPositions = positions;
    if (accountId) {
      filteredPositions = positions.filter((p: any) => p.accountId === accountId);
    }

    // Convert positions to holdings format
    const holdings: Holding[] = filteredPositions.map((position: any) => {
      const security = position.security || {};
      const account = position.account || {};
      const assetType = security.class || "Stock";
      const sector = security.sector || mapClassToSector(assetType, security.symbol || "");

      return {
        securityId: position.securityId,
        symbol: security.symbol || "",
        name: security.name || security.symbol || "",
        assetType,
        sector,
        quantity: position.openQuantity || 0,
        avgPrice: position.averageEntryPrice || 0,
        bookValue: position.totalCost || 0,
        lastPrice: position.currentPrice || 0,
        marketValue: position.currentMarketValue || 0,
        unrealizedPnL: position.openPnl || 0,
        unrealizedPnLPercent: position.totalCost > 0 
          ? ((position.openPnl || 0) / position.totalCost) * 100 
          : 0,
        accountId: position.accountId,
        accountName: account.name || "Unknown Account",
      };
    });

    // Store in cache before returning
    if (useCache) {
      holdingsCache.set(cacheKey, { data: holdings, timestamp: Date.now() });
    }
    return holdings;
  }

  // Fallback to calculating from transactions if no positions
  // Note: This fallback is slower but necessary if views/positions are not available

  // OPTIMIZED: Select only necessary fields instead of * to reduce payload size
  let query = supabase
    .from("InvestmentTransaction")
    .select(`
      id,
      date,
      type,
      quantity,
      price,
      fees,
      securityId,
      accountId,
      security:Security(id, symbol, name, class, sector),
      account:Account!InvestmentTransaction_accountId_fkey(id, name)
    `)
    .order("date", { ascending: true });

  if (accountId) {
    query = query.eq("accountId", accountId);
  }

  const { data: transactions, error } = await query;

  if (error) {
    log.error("Error fetching investment transactions:", error);
    logger.error("[getHoldings] Query error:", error);
    return [];
  }

  if (!transactions || transactions.length === 0) {
    logger.log("[getHoldings] No transactions found for user:", user.id);
    return [];
  }
  
  logger.log("[getHoldings] Found", transactions.length, "transactions for user:", user.id);

  // Group by security and account (same security in different accounts = different holdings)
  const holdingKeyMap = new Map<string, Holding>();
  
  // Track skipped transactions for summary log
  const skippedTransactions: string[] = [];

  for (const tx of transactions || []) {
    // Skip transactions without securityId/security, but allow transfer_in/transfer_out
    // which don't require a security
    if (!tx.securityId || !tx.security) {
      // Transfer transactions don't require a security, so this is expected
      if (tx.type === "transfer_in" || tx.type === "transfer_out") {
        // Silently skip transfer transactions as they don't affect holdings
        continue;
      }
      // NOTE: Transactions of type buy, sell, dividend, or interest should have a securityId
      // If you see many skipped transactions, run the fix script:
      // npx tsx scripts/fix-investment-transactions-security.ts
      // Track skipped transactions for summary log (only in development)
      if (process.env.NODE_ENV === "development") {
        skippedTransactions.push(`${tx.id} (${tx.type})`);
      }
      continue;
    }

    const securityId = tx.securityId;
    const accountIdForTx = tx.accountId;
    const account = tx.account as any;
    const accountName = account?.name || "Unknown Account";
    
    // Create unique key for security+account combination
    const holdingKey = `${securityId}_${accountIdForTx}`;

    // Handle security as either array or single object (Supabase can return either)
    const securityData = Array.isArray(tx.security) ? tx.security[0] : tx.security;
    if (!securityData) {
      continue;
    }

    const symbol = securityData.symbol;
    const name = securityData.name;
    const assetType = securityData.class || "Stock";
    const sector = securityData.sector || mapClassToSector(assetType, symbol);

    if (!holdingKeyMap.has(holdingKey)) {
      holdingKeyMap.set(holdingKey, {
        securityId,
        symbol,
        name,
        assetType,
        sector,
        quantity: 0,
        avgPrice: 0,
        bookValue: 0,
        lastPrice: 0,
        marketValue: 0,
        unrealizedPnL: 0,
        unrealizedPnLPercent: 0,
        accountId: accountIdForTx,
        accountName,
      });
    }

    const holding = holdingKeyMap.get(holdingKey)!;

    if (tx.type === "buy" && tx.quantity && tx.price) {
      const newCost = tx.quantity * tx.price + (tx.fees || 0);
      const totalCost = holding.bookValue + newCost;
      const totalQuantity = holding.quantity + tx.quantity;

      // Weighted average cost
      holding.avgPrice = totalQuantity > 0 ? totalCost / totalQuantity : tx.price;
      holding.quantity = totalQuantity;
      holding.bookValue = totalCost;
    } else if (tx.type === "sell" && tx.quantity && tx.price) {
      // FIFO: reduce quantity, maintain avgPrice
      holding.quantity = Math.max(0, holding.quantity - tx.quantity);
      // Reduce book value proportionally
      const soldCost = tx.quantity * holding.avgPrice;
      holding.bookValue = Math.max(0, holding.bookValue - soldCost);
    } else if (tx.type === "dividend" || tx.type === "interest") {
      // Dividends and interest don't affect holdings
    }
  }

  // Get latest prices for all securities in one query
  const securityIds = Array.from(new Set(Array.from(holdingKeyMap.values()).map(h => h.securityId)));
  if (securityIds.length > 0) {
    const { data: prices } = await supabase
      .from("SecurityPrice")
      .select("securityId, price, date")
      .in("securityId", securityIds)
      .order("securityId", { ascending: true })
      .order("date", { ascending: false });

    // Group prices by securityId, keeping only the latest (first after sort)
    const priceMap = new Map<string, number>();
    if (prices) {
      for (const price of prices) {
        if (!priceMap.has(price.securityId)) {
          priceMap.set(price.securityId, price.price);
        }
      }
    }

    // Apply prices to holdings
    for (const [holdingKey, holding] of holdingKeyMap) {
      const latestPrice = priceMap.get(holding.securityId);
      if (latestPrice && latestPrice > 0) {
        holding.lastPrice = latestPrice;
        holding.marketValue = holding.quantity * latestPrice;
        holding.unrealizedPnL = holding.marketValue - holding.bookValue;
        holding.unrealizedPnLPercent = holding.bookValue > 0 
          ? (holding.unrealizedPnL / holding.bookValue) * 100 
          : 0;
      } else {
        // Fallback: use average price if no current price available
        // This ensures marketValue is calculated even without SecurityPrice entries
        if (holding.avgPrice > 0) {
          holding.lastPrice = holding.avgPrice;
          holding.marketValue = holding.quantity * holding.avgPrice;
          holding.unrealizedPnL = 0; // No P&L if using book value
          holding.unrealizedPnLPercent = 0;
        } else {
          // Last resort: if no price at all, use book value as market value
          // This ensures we at least show something instead of zero
          logger.warn(`[getHoldings] No price found for ${holding.symbol} (securityId: ${holding.securityId}). Using book value as fallback.`);
          holding.lastPrice = holding.bookValue > 0 && holding.quantity > 0 
            ? holding.bookValue / holding.quantity 
            : 0;
          holding.marketValue = holding.bookValue; // Use book value as market value
          holding.unrealizedPnL = 0;
          holding.unrealizedPnLPercent = 0;
        }
      }
    }
  } else {
    // No prices found at all - use book value as fallback for all holdings
    logger.warn("[getHoldings] No prices found for any security. Using book value as market value fallback.");
    for (const [holdingKey, holding] of holdingKeyMap) {
      if (holding.quantity > 0 && holding.bookValue > 0) {
        holding.lastPrice = holding.bookValue / holding.quantity;
        holding.marketValue = holding.bookValue;
        holding.unrealizedPnL = 0;
        holding.unrealizedPnLPercent = 0;
      }
    }
  }

  // Filter out zero quantity holdings
  const holdings = Array.from(holdingKeyMap.values()).filter((h) => h.quantity > 0);
  
  // Log summary only in development and only if there were skipped transactions
  if (process.env.NODE_ENV === "development") {
    if (skippedTransactions.length > 0) {
      log.debug(`Skipped ${skippedTransactions.length} transactions without securityId:`, skippedTransactions.slice(0, 5));
      if (skippedTransactions.length > 5) {
        log.debug(`... and ${skippedTransactions.length - 5} more`);
      }
    }
    logger.log(`[getHoldings] Final holdings count: ${holdings.length}`);
    if (holdings.length > 0) {
      const totalMarketValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);
      logger.log(`[getHoldings] Total market value: ${totalMarketValue}`);
    }
  }
  
  // Store in cache before returning (for transaction-based holdings)
  if (useCache) {
    holdingsCache.set(cacheKey, { data: holdings, timestamp: Date.now() });
  }
  
  return holdings;
}

// Helper function to clear holdings cache (useful after transactions are created/updated)
export async function clearHoldingsCache(userId?: string): Promise<void> {
  if (userId) {
    // Clear all cache entries for this user
    for (const key of holdingsCache.keys()) {
      if (key.startsWith(`holdings:${userId}:`)) {
        holdingsCache.delete(key);
      }
    }
  } else {
    // Clear all cache
    holdingsCache.clear();
  }
}

export async function getPortfolioValue(accountId?: string, accessToken?: string, refreshToken?: string): Promise<number> {
  const holdings = await getHoldings(accountId, accessToken, refreshToken);
  return holdings.reduce((sum, h) => sum + h.marketValue, 0);
}

export async function getAssetAllocation(accountId?: string, accessToken?: string, refreshToken?: string) {
  const holdings = await getHoldings(accountId, accessToken, refreshToken);

  const byClass = holdings.reduce(
    (acc, holding) => {
      // Get security class from holdings (we'll need to fetch securities separately)
      // For now, we'll group by symbol prefix as a fallback
      const classKey = holding.symbol.startsWith("BTC") ? "crypto" : "etf";

      if (!acc[classKey]) {
        acc[classKey] = { value: 0, count: 0 };
      }
      acc[classKey].value += holding.marketValue;
      acc[classKey].count += 1;

      return acc;
    },
    {} as Record<string, { value: number; count: number }>
  );

  return byClass;
}

export async function getInvestmentTransactions(filters?: {
  accountId?: string;
  securityId?: string;
  startDate?: Date;
  endDate?: Date;
}) {
    const supabase = await createServerClient();

  // OPTIMIZED: Select only necessary fields instead of * to reduce payload size
  let query = supabase
    .from("InvestmentTransaction")
    .select(`
      id,
      date,
      type,
      quantity,
      price,
      fees,
      notes,
      securityId,
      accountId,
      createdAt,
      updatedAt,
      account:Account(id, name, type),
      security:Security(id, symbol, name, class, sector)
    `)
    .order("date", { ascending: false });

  // Note: Supabase may return relations as arrays or objects depending on the relationship

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
    return [];
  }

  return data || [];
}

export async function createInvestmentTransaction(data: InvestmentTransactionFormData) {
    const supabase = await createServerClient();

  const id = crypto.randomUUID();
  const date = data.date instanceof Date ? data.date : new Date(data.date);
  // Use formatDateOnly to save only the date (00:00:00) in user's local timezone
  const transactionDate = formatDateOnly(date);
  const now = formatTimestamp(new Date());

  const { data: transaction, error } = await supabase
    .from("InvestmentTransaction")
    .insert({
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
    })
    .select()
    .single();

  if (error) {
    logger.error("Supabase error creating investment transaction:", error);
    throw new Error(`Failed to create investment transaction: ${error.message || JSON.stringify(error)}`);
  }

  return transaction;
}

export async function updateInvestmentTransaction(id: string, data: Partial<InvestmentTransactionFormData>) {
    const supabase = await createServerClient();

  const updateData: Record<string, unknown> = {};
  if (data.date) {
    const date = data.date instanceof Date ? data.date : new Date(data.date);
    // Use formatDateOnly to save only the date (00:00:00) in user's local timezone
    updateData.date = formatDateOnly(date);
  }
  if (data.accountId) updateData.accountId = data.accountId;
  if (data.securityId !== undefined) updateData.securityId = data.securityId || null;
  if (data.type) updateData.type = data.type;
  if (data.quantity !== undefined) updateData.quantity = data.quantity || null;
  if (data.price !== undefined) updateData.price = data.price || null;
  if (data.fees !== undefined) updateData.fees = data.fees || 0;
  if (data.notes !== undefined) updateData.notes = data.notes || null;
  updateData.updatedAt = formatTimestamp(new Date());

  const { data: transaction, error } = await supabase
    .from("InvestmentTransaction")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logger.error("Supabase error updating investment transaction:", error);
    throw new Error(`Failed to update investment transaction: ${error.message || JSON.stringify(error)}`);
  }

  return transaction;
}

export async function deleteInvestmentTransaction(id: string) {
    const supabase = await createServerClient();

  const { error } = await supabase.from("InvestmentTransaction").delete().eq("id", id);

  if (error) {
    logger.error("Supabase error deleting investment transaction:", error);
    throw new Error(`Failed to delete investment transaction: ${error.message || JSON.stringify(error)}`);
  }
}

export async function getSecurities() {
    const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("Security")
    .select("*")
    .order("symbol", { ascending: true });

  if (error) {
    logger.error("Error fetching securities:", error);
    return [];
  }

  return data || [];
}

export async function createSecurity(data: { symbol: string; name: string; class: string }) {
    const supabase = await createServerClient();

  const id = crypto.randomUUID();
  const now = formatTimestamp(new Date());

  // Normalize asset type to ensure consistent format (Stock, ETF, Crypto, etc.)
  const normalizedClass = normalizeAssetType(data.class);

  const { data: security, error } = await supabase
    .from("Security")
    .insert({
      id,
      symbol: data.symbol.toUpperCase(),
      name: data.name,
      class: normalizedClass,
      createdAt: now,
      updatedAt: now,
    })
    .select()
    .single();

  if (error) {
    logger.error("Supabase error creating security:", error);
    throw new Error(`Failed to create security: ${error.message || JSON.stringify(error)}`);
  }

  return security;
}

export async function getSecurityPrices(securityId?: string) {
    const supabase = await createServerClient();

  let query = supabase
    .from("SecurityPrice")
    .select(`
      *,
      security:Security(*)
    `)
    .order("date", { ascending: false });

  if (securityId) {
    query = query.eq("securityId", securityId);
  }

  const { data, error } = await query;

  if (error) {
    return [];
  }

  return data || [];
}

export async function createSecurityPrice(data: SecurityPriceFormData) {
    const supabase = await createServerClient();

  const id = crypto.randomUUID();
  const date = data.date instanceof Date ? data.date : new Date(data.date);
  const priceDate = formatTimestamp(date);
  const now = formatTimestamp(new Date());

  const { data: price, error } = await supabase
    .from("SecurityPrice")
    .insert({
      id,
      securityId: data.securityId,
      date: priceDate,
      price: data.price,
      createdAt: now,
    })
    .select()
    .single();

  if (error) {
    logger.error("Supabase error creating security price:", error);
    throw new Error(`Failed to create security price: ${error.message || JSON.stringify(error)}`);
  }

  return price;
}

export async function getInvestmentAccounts(accessToken?: string, refreshToken?: string) {
  const supabase = await createServerClient(accessToken, refreshToken);
  const log = logger.withPrefix("INVESTMENTS");

  // Verify authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    log.error("Error getting user in getInvestmentAccounts:", authError);
    return [];
  }

  // Get accounts of type "investment" from Account table
  const { data, error } = await supabase
    .from("Account")
    .select("*")
    .eq("type", "investment")
    .order("name", { ascending: true });

  if (error) {
    log.error("Error fetching investment accounts:", error);
    return [];
  }

  return data || [];
}

export async function createInvestmentAccount(data: InvestmentAccountFormData) {
  const supabase = await createServerClient();

  // Get current user
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
      type: "investment", // Always set type to "investment"
      userId: user.id,
      createdAt: now,
      updatedAt: now,
    })
    .select()
    .single();

  if (error) {
    logger.error("Supabase error creating investment account:", error);
    throw new Error(`Failed to create investment account: ${error.message || JSON.stringify(error)}`);
  }

  return account;
}
