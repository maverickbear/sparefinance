/**
 * Portfolio Service
 * Business logic for portfolio aggregation and calculations
 * This service aggregates data from Investments to provide portfolio-level views
 */

import { BasePortfolioHolding, BasePortfolioSummary, BasePortfolioAccount, BaseHistoricalDataPoint, BasePortfolioTransaction } from "../../domain/portfolio/portfolio.types";
import { makeInvestmentsService } from "../investments/investments.factory";
import { BaseHolding } from "../../domain/investments/investments.types";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { formatDateStart, formatDateEnd } from "@/src/infrastructure/utils/timestamp";
import { subDays } from "date-fns";
import { logger } from "@/src/infrastructure/utils/logger";
import { cache } from "@/src/infrastructure/external/redis";
import { unstable_cache } from "next/cache";

export class PortfolioService {
  /**
   * Convert investment holding to portfolio holding format
   */
  private convertHolding(holding: BaseHolding): BasePortfolioHolding {
    return {
      id: holding.securityId,
      symbol: holding.symbol,
      name: holding.name,
      assetType: holding.assetType as "Stock" | "ETF" | "Crypto" | "Fund",
      sector: holding.sector,
      quantity: holding.quantity,
      avgPrice: holding.avgPrice,
      currentPrice: holding.lastPrice,
      marketValue: holding.marketValue,
      bookValue: holding.bookValue,
      unrealizedPnL: holding.unrealizedPnL,
      unrealizedPnLPercent: holding.unrealizedPnLPercent,
      accountId: holding.accountId,
      accountName: holding.accountName,
    };
  }

  /**
   * Get portfolio holdings
   */
  async getPortfolioHoldings(
    accessToken?: string,
    refreshToken?: string
  ): Promise<BasePortfolioHolding[]> {
    const investmentsService = makeInvestmentsService();
    const holdings = await investmentsService.getHoldings(undefined, accessToken, refreshToken);
    return holdings.map(h => this.convertHolding(h));
  }

  /**
   * Get portfolio summary (internal, without cache)
   */
  async getPortfolioSummaryInternal(
    accessToken?: string,
    refreshToken?: string
  ): Promise<BasePortfolioSummary> {
    const supabase = await createServerClient(accessToken, refreshToken);
    const investmentsService = makeInvestmentsService();

    const holdings = await investmentsService.getHoldings(undefined, accessToken, refreshToken);
    const accounts = await investmentsService.getInvestmentAccounts(accessToken, refreshToken);

    // Get investment account balances
    const { data: investmentAccounts } = await supabase
      .from("InvestmentAccount")
      .select("totalEquity, marketValue, cash, id");

    // Calculate total value
    let totalValue: number;
    if (investmentAccounts && investmentAccounts.length > 0) {
      const investmentValue = investmentAccounts.reduce((sum, account) => {
        const accountValue = account.totalEquity ?? 
          ((account.marketValue || 0) + (account.cash || 0));
        return sum + accountValue;
      }, 0);
      
      const investmentAccountIds = new Set(investmentAccounts.map(ia => ia.id));
      const holdingsValue = holdings
        .filter(h => !investmentAccountIds.has(h.accountId))
        .reduce((sum, h) => sum + h.marketValue, 0);
      
      totalValue = investmentValue + holdingsValue;
    } else {
      totalValue = holdings.reduce((sum, h) => sum + (h.marketValue || 0), 0);
    }

    const totalCost = holdings.reduce((sum, h) => sum + h.bookValue, 0);
    const totalReturn = totalValue - totalCost;
    const totalReturnPercent = totalCost > 0 ? (totalReturn / totalCost) * 100 : 0;

    // Calculate day change (simplified - full logic in lib/api/portfolio.ts)
    let dayChange = 0;
    let dayChangePercent = 0;
    
    try {
      const yesterday = subDays(new Date(), 1);
      const securityIds = Array.from(new Set(holdings.map(h => h.securityId)));
      
      if (securityIds.length > 0) {
        const { data: yesterdayPrices } = await supabase
          .from("SecurityPrice")
          .select("securityId, price, date")
          .in("securityId", securityIds)
          .eq("date", formatDateStart(yesterday));
        
        if (yesterdayPrices && yesterdayPrices.length > 0) {
          const priceMap = new Map(yesterdayPrices.map(p => [p.securityId, p.price]));
          let yesterdayValue = 0;
          
          for (const holding of holdings) {
            const price = priceMap.get(holding.securityId);
            if (price !== undefined && price > 0) {
              yesterdayValue += holding.quantity * price;
            } else {
              yesterdayValue += holding.quantity * holding.lastPrice;
            }
          }
          
          if (yesterdayValue > 0) {
            dayChange = totalValue - yesterdayValue;
            dayChangePercent = (dayChange / yesterdayValue) * 100;
          }
        }
      }
    } catch (error) {
      logger.error("[PortfolioService] Error calculating day change:", error);
    }

    return {
      totalValue,
      dayChange,
      dayChangePercent,
      totalReturn,
      totalReturnPercent,
      totalCost,
      holdingsCount: holdings.length,
    };
  }

  /**
   * Get portfolio summary (with caching)
   */
  async getPortfolioSummary(userId: string): Promise<BasePortfolioSummary> {
    // Try Redis cache first
    const cacheKey = `portfolio:summary:${userId}`;
    const cached = await cache.get<BasePortfolioSummary>(cacheKey);
    if (cached) {
      return cached;
    }

    // Get session tokens
    let accessToken: string | undefined;
    let refreshToken: string | undefined;
    try {
      const supabase = await createServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          accessToken = session.access_token;
          refreshToken = session.refresh_token;
        }
      }
    } catch (error: any) {
      logger.warn("[PortfolioService] Could not get session tokens:", error?.message);
    }

    // Use Next.js cache as fallback
    const result = await unstable_cache(
      async () => this.getPortfolioSummaryInternal(accessToken, refreshToken),
      [`portfolio-summary-${userId}`],
      {
        tags: ['investments', 'portfolio'],
        revalidate: 30,
      }
    )();

    // Store in Redis cache
    await cache.set(cacheKey, result, 300);

    return result;
  }

  /**
   * Get portfolio accounts
   */
  async getPortfolioAccounts(
    accessToken?: string,
    refreshToken?: string
  ): Promise<BasePortfolioAccount[]> {
    const supabase = await createServerClient(accessToken, refreshToken);
    const investmentsService = makeInvestmentsService();

    const holdings = await investmentsService.getHoldings(undefined, accessToken, refreshToken);
    const accounts = await investmentsService.getInvestmentAccounts(accessToken, refreshToken);

    // Get investment account balances
    const { data: investmentAccountsFull } = await supabase
      .from("InvestmentAccount")
      .select("*");

    const investmentAccountValues = new Map<string, number>();
    if (investmentAccountsFull) {
      for (const account of investmentAccountsFull) {
        const accountValue = account.totalEquity ?? 
          ((account.marketValue || 0) + (account.cash || 0));
        investmentAccountValues.set(account.id, accountValue);
      }
    }

    const accountValues = accounts.map((account) => {
      if (investmentAccountValues.has(account.id)) {
        return investmentAccountValues.get(account.id)!;
      } else {
        const accountHoldings = holdings.filter((h) => h.accountId === account.id);
        return accountHoldings.reduce((sum, h) => sum + h.marketValue, 0);
      }
    });

    const totalValue = accountValues.reduce((sum, value) => sum + value, 0);

    return accounts.map((account, index) => {
      const accountValue = accountValues[index];
      const allocationPercent = totalValue > 0 ? (accountValue / totalValue) * 100 : 0;

      return {
        id: account.id,
        name: account.name,
        type: account.type,
        value: accountValue,
        allocationPercent,
      };
    });
  }

  /**
   * Get portfolio historical data (simplified version)
   * Full implementation is complex and kept in lib/api/portfolio.ts for now
   */
  async getPortfolioHistoricalData(
    days: number = 365,
    userId: string
  ): Promise<BaseHistoricalDataPoint[]> {
    // Try Redis cache first
    const cacheKey = `portfolio:historical:${userId}:${days}`;
    const cached = await cache.get<BaseHistoricalDataPoint[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Get session tokens
    let accessToken: string | undefined;
    let refreshToken: string | undefined;
    try {
      const supabase = await createServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          accessToken = session.access_token;
          refreshToken = session.refresh_token;
        }
      }
    } catch (error: any) {
      logger.warn("[PortfolioService] Could not get session tokens:", error?.message);
    }

    // For now, use the legacy function as it's very complex
    // TODO: Refactor this into the service layer
    const { getPortfolioHistoricalDataInternal } = await import("@/lib/api/portfolio");
    const result = await getPortfolioHistoricalDataInternal(days, accessToken, refreshToken);

    // Store in Redis cache
    await cache.set(cacheKey, result, 300);

    return result;
  }

  /**
   * Get recent portfolio transactions
   */
  async getPortfolioTransactions(limit: number = 10): Promise<BasePortfolioTransaction[]> {
    const endDate = new Date();
    const startDate = subDays(endDate, 30);

    const investmentsService = makeInvestmentsService();
    const transactions = await investmentsService.getInvestmentTransactions({
      startDate,
      endDate,
    });

    return transactions.slice(0, limit).map((tx) => ({
      id: tx.id,
      date: tx.date instanceof Date ? tx.date.toISOString().split("T")[0] : (typeof tx.date === 'string' ? tx.date.split("T")[0] : ''),
      type: tx.type as "buy" | "sell" | "dividend" | "interest",
      symbol: tx.security?.symbol || "",
      name: tx.security?.name || "",
      quantity: tx.quantity || undefined,
      price: tx.price || undefined,
      amount: tx.quantity && tx.price ? tx.quantity * tx.price : 0,
      accountName: tx.account?.name || "Unknown Account",
    }));
  }

  /**
   * Invalidate portfolio cache
   */
  async invalidatePortfolioCache(userId?: string): Promise<void> {
    const targetUserId = userId;
    if (!targetUserId) {
      return;
    }

    const cacheKey = `portfolio:summary:${targetUserId}`;
    await cache.delete(cacheKey);
    
    // Also invalidate Next.js cache
    const { revalidateTag } = await import("next/cache");
    revalidateTag('investments', 'max');
    revalidateTag('portfolio', 'max');
    
    // Clear holdings cache
    const investmentsService = makeInvestmentsService();
    investmentsService.clearHoldingsCache(targetUserId);
  }
}

