"use server";

import { createServerClient } from "@/lib/supabase-server";
import { InvestmentTransactionFormData, SecurityPriceFormData, InvestmentAccountFormData } from "@/lib/validations/investment";
import { formatTimestamp, formatDateStart, formatDateEnd } from "@/lib/utils/timestamp";
import { mapClassToSector } from "@/lib/utils/portfolio-utils";

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

export async function getHoldings(accountId?: string): Promise<Holding[]> {
  const supabase = await createServerClient();

  // First, try to get holdings from Questrade positions (more accurate)
  const { data: questradePositions, error: positionsError } = await supabase
    .from("Position")
    .select(`
      *,
      security:Security(*),
      account:InvestmentAccount(*)
    `)
    .gt("openQuantity", 0)
    .order("lastUpdatedAt", { ascending: false });

  if (!positionsError && questradePositions && questradePositions.length > 0) {
    console.log(`Found ${questradePositions.length} Questrade positions`);
    
    // Filter by accountId if provided
    let positions = questradePositions;
    if (accountId) {
      positions = positions.filter((p: any) => p.accountId === accountId);
    }

    // Convert positions to holdings format
    const holdings: Holding[] = positions.map((position: any) => {
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

    return holdings;
  }

  // Fallback to calculating from transactions if no Questrade positions
  console.log("No Questrade positions found, calculating from transactions");

  let query = supabase
    .from("InvestmentTransaction")
    .select(`
      *,
      security:Security(*),
      account:InvestmentAccount(*)
    `)
    .order("date", { ascending: true });

  if (accountId) {
    query = query.eq("accountId", accountId);
  }

  const { data: transactions, error } = await query;

  if (error) {
    console.error("Error fetching investment transactions:", error);
    return [];
  }

  if (!transactions || transactions.length === 0) {
    console.log("No investment transactions found");
    return [];
  }

  console.log(`Found ${transactions.length} investment transactions`);

  // Group by security and account (same security in different accounts = different holdings)
  const holdingKeyMap = new Map<string, Holding>();

  for (const tx of transactions || []) {
    if (!tx.securityId || !tx.security) {
      console.log(`Skipping transaction ${tx.id} - no securityId or security`);
      continue;
    }

    const securityId = tx.securityId;
    const accountIdForTx = tx.accountId;
    const account = tx.account as any;
    const accountName = account?.name || "Unknown Account";
    
    // Create unique key for security+account combination
    const holdingKey = `${securityId}_${accountIdForTx}`;

    const symbol = tx.security.symbol;
    const name = tx.security.name;
    const assetType = tx.security.class || "Stock";
    const sector = tx.security.sector || mapClassToSector(assetType, symbol);

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
      if (latestPrice) {
        holding.lastPrice = latestPrice;
        holding.marketValue = holding.quantity * latestPrice;
        holding.unrealizedPnL = holding.marketValue - holding.bookValue;
        holding.unrealizedPnLPercent = holding.bookValue > 0 
          ? (holding.unrealizedPnL / holding.bookValue) * 100 
          : 0;
      }
    }
  }

  // Filter out zero quantity holdings
  const holdings = Array.from(holdingKeyMap.values()).filter((h) => h.quantity > 0);
  console.log(`Calculated ${holdings.length} holdings with quantity > 0`);
  return holdings;
}

export async function getPortfolioValue(accountId?: string): Promise<number> {
  const holdings = await getHoldings(accountId);
  return holdings.reduce((sum, h) => sum + h.marketValue, 0);
}

export async function getAssetAllocation(accountId?: string) {
  const holdings = await getHoldings(accountId);

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

  let query = supabase
    .from("InvestmentTransaction")
    .select(`
      *,
      account:InvestmentAccount(*),
      security:Security(*)
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
  const transactionDate = formatTimestamp(date);
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
    console.error("Supabase error creating investment transaction:", error);
    throw new Error(`Failed to create investment transaction: ${error.message || JSON.stringify(error)}`);
  }

  return transaction;
}

export async function updateInvestmentTransaction(id: string, data: Partial<InvestmentTransactionFormData>) {
    const supabase = await createServerClient();

  const updateData: Record<string, unknown> = {};
  if (data.date) {
    const date = data.date instanceof Date ? data.date : new Date(data.date);
    updateData.date = formatTimestamp(date);
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
    console.error("Supabase error updating investment transaction:", error);
    throw new Error(`Failed to update investment transaction: ${error.message || JSON.stringify(error)}`);
  }

  return transaction;
}

export async function deleteInvestmentTransaction(id: string) {
    const supabase = await createServerClient();

  const { error } = await supabase.from("InvestmentTransaction").delete().eq("id", id);

  if (error) {
    console.error("Supabase error deleting investment transaction:", error);
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
    console.error("Error fetching securities:", error);
    return [];
  }

  return data || [];
}

export async function createSecurity(data: { symbol: string; name: string; class: string }) {
    const supabase = await createServerClient();

  const id = crypto.randomUUID();
  const now = formatTimestamp(new Date());

  const { data: security, error } = await supabase
    .from("Security")
    .insert({
      id,
      symbol: data.symbol.toUpperCase(),
      name: data.name,
      class: data.class,
      createdAt: now,
      updatedAt: now,
    })
    .select()
    .single();

  if (error) {
    console.error("Supabase error creating security:", error);
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
    console.error("Supabase error creating security price:", error);
    throw new Error(`Failed to create security price: ${error.message || JSON.stringify(error)}`);
  }

  return price;
}

export async function getInvestmentAccounts() {
    const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("InvestmentAccount")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
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

  const { data: account, error } = await supabase
    .from("InvestmentAccount")
    .insert({
      id,
      name: data.name,
      type: data.type,
      accountId: data.accountId || null,
      userId: user.id,
      createdAt: now,
      updatedAt: now,
    })
    .select()
    .single();

  if (error) {
    console.error("Supabase error creating investment account:", error);
    throw new Error(`Failed to create investment account: ${error.message || JSON.stringify(error)}`);
  }

  return account;
}
