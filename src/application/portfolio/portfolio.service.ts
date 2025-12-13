/**
 * Portfolio Service
 * Business logic for portfolio aggregation and calculations
 * This service aggregates data from Investments to provide portfolio-level views
 */

import { BasePortfolioHolding, BasePortfolioSummary, BasePortfolioAccount, BaseHistoricalDataPoint, BasePortfolioTransaction } from "../../domain/portfolio/portfolio.types";
import { makeInvestmentsService } from "../investments/investments.factory";
import { BaseHolding } from "../../domain/investments/investments.types";
import { PortfolioMapper } from "./portfolio.mapper";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { formatDateStart, formatDateEnd } from "@/src/infrastructure/utils/timestamp";
import { subDays } from "date-fns";
import { logger } from "@/src/infrastructure/utils/logger";

export class PortfolioService {

  /**
   * Get portfolio holdings
   */
  async getPortfolioHoldings(
    accessToken?: string,
    refreshToken?: string
  ): Promise<BasePortfolioHolding[]> {
    const investmentsService = makeInvestmentsService();
    const holdings = await investmentsService.getHoldings(undefined, accessToken, refreshToken);
    return PortfolioMapper.investmentHoldingsToPortfolioHoldings(holdings);
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
      .from("investment_accounts")
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

    // Calculate day change
    let dayChange = 0;
    let dayChangePercent = 0;
    
    try {
      const yesterday = subDays(new Date(), 1);
      const securityIds = Array.from(new Set(holdings.map(h => h.securityId)));
      
      if (securityIds.length > 0) {
        const { data: yesterdayPrices } = await supabase
          .from("security_prices")
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
   * Get portfolio summary
   */
  async getPortfolioSummary(userId: string): Promise<BasePortfolioSummary> {
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

    return this.getPortfolioSummaryInternal(accessToken, refreshToken);
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
      .from("investment_accounts")
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
   * Get portfolio historical data
   */
  async getPortfolioHistoricalData(
    days: number = 365,
    userId: string
  ): Promise<BaseHistoricalDataPoint[]> {
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

    // Use InvestmentsService to get data, then calculate historical data
    const investmentsService = makeInvestmentsService();
    const holdings = await investmentsService.getHoldings(undefined, accessToken, refreshToken);
    const investmentAccounts = await investmentsService.getInvestmentAccounts(accessToken, refreshToken);
    
    // Get summary for current value
    const summary = await this.getPortfolioSummaryInternal(accessToken, refreshToken);
    return this.calculateHistoricalData(
      days,
      holdings,
      investmentAccounts,
      summary.totalValue,
      accessToken,
      refreshToken
    );
  }

  /**
   * Calculate historical data (private method)
   * This is a complex calculation that processes transactions and prices over time
   */
  private async calculateHistoricalData(
    days: number,
    holdings: BaseHolding[],
    investmentAccounts: any[],
    currentValue: number,
    accessToken?: string,
    refreshToken?: string
  ): Promise<BaseHistoricalDataPoint[]> {
    const supabase = await createServerClient(accessToken, refreshToken);
    const endDate = new Date();
    const startDate = subDays(endDate, days);

    // Convert holdings to portfolio format
    const portfolioHoldings = PortfolioMapper.investmentHoldingsToPortfolioHoldings(holdings);
    const securityIds = Array.from(new Set(portfolioHoldings.map(h => h.id)));

    if (securityIds.length === 0 && (!investmentAccounts || investmentAccounts.length === 0)) {
      return [];
    }

    // Get historical prices
    const { data: historicalPrices } = await supabase
      .from("security_prices")
      .select("securityId, price, date")
      .in("securityId", securityIds)
      .gte("date", formatDateStart(startDate))
      .lte("date", formatDateEnd(endDate))
      .order("date", { ascending: true });

    // Group prices by date
    const pricesByDate = new Map<string, Map<string, number>>();
    if (historicalPrices) {
      for (const price of historicalPrices) {
        const dateKey = price.date instanceof Date 
          ? price.date.toISOString().split("T")[0]
          : price.date.split("T")[0];
        
        if (!pricesByDate.has(dateKey)) {
          pricesByDate.set(dateKey, new Map());
        }
        pricesByDate.get(dateKey)!.set((price as any).security_id, price.price);
      }
    }

    // Get investment transactions
    const investmentsService = makeInvestmentsService();
    const transactions = await investmentsService.getInvestmentTransactions({
      startDate,
      endDate,
    });

    // Group transactions by date
    const transactionsByDate = new Map<string, any[]>();
    for (const tx of transactions) {
      const dateKey = tx.date instanceof Date 
        ? tx.date.toISOString().split("T")[0]
        : (typeof tx.date === 'string' ? tx.date.split("T")[0] : '');
      
      if (!transactionsByDate.has(dateKey)) {
        transactionsByDate.set(dateKey, []);
      }
      transactionsByDate.get(dateKey)!.push(tx);
    }

    // Calculate portfolio value for each day
    const data: BaseHistoricalDataPoint[] = [];
    const today = new Date();
    const holdingsOverTime = new Map<string, { quantity: number; avgPrice: number }>();

    // Initialize with current holdings
    for (const holding of portfolioHoldings) {
      if (holding.quantity > 0) {
        holdingsOverTime.set(holding.id, {
          quantity: holding.quantity,
          avgPrice: holding.avgPrice,
        });
      }
    }

    // Process each day chronologically
    const todayKey = today.toISOString().split("T")[0];
    for (let i = 0; i <= days; i++) {
      const date = subDays(today, days - i);
      const dateKey = date.toISOString().split("T")[0];

      // Process transactions on this date
      const transactionsOnDate = transactionsByDate.get(dateKey) || [];
      for (const tx of transactionsOnDate) {
        if (!tx.securityId || (tx.type !== "buy" && tx.type !== "sell")) continue;

        const securityId = tx.securityId;
        const quantity = tx.quantity || 0;
        const price = tx.price || 0;
        const fees = tx.fees || 0;

        if (!holdingsOverTime.has(securityId)) {
          holdingsOverTime.set(securityId, { quantity: 0, avgPrice: 0 });
        }

        const holding = holdingsOverTime.get(securityId)!;

        if (tx.type === "buy") {
          const cost = quantity * price + fees;
          const newQuantity = holding.quantity + quantity;
          const newTotalCost = holding.quantity * holding.avgPrice + cost;
          holding.quantity = newQuantity;
          holding.avgPrice = newQuantity > 0 ? newTotalCost / newQuantity : 0;
        } else if (tx.type === "sell") {
          holding.quantity = Math.max(0, holding.quantity - quantity);
        }
      }

      // Calculate portfolio value for this date
      let portfolioValue = 0;
      const pricesForDate = pricesByDate.get(dateKey);

      if (dateKey === todayKey) {
        portfolioValue = currentValue;
      } else if (pricesForDate && holdingsOverTime.size > 0) {
        for (const [securityId, holding] of holdingsOverTime) {
          if (holding.quantity <= 0) continue;
          
          const price = pricesForDate.get(securityId);
          if (price !== undefined) {
            portfolioValue += holding.quantity * price;
          } else {
            portfolioValue += holding.quantity * holding.avgPrice;
          }
        }
      } else if (holdingsOverTime.size > 0) {
        for (const [securityId, holding] of holdingsOverTime) {
          if (holding.quantity > 0) {
            portfolioValue += holding.quantity * holding.avgPrice;
          }
        }
      }

      data.push({
        date: dateKey,
        value: Math.max(0, portfolioValue),
      });
    }

    // Ensure today's value is accurate
    if (data.length > 0) {
      const todayIndex = data.findIndex(d => d.date === todayKey);
      if (todayIndex >= 0) {
        data[todayIndex].value = currentValue;
      } else {
        data.push({
          date: todayKey,
          value: currentValue,
        });
      }
    } else {
      data.push({
        date: todayKey,
        value: currentValue,
      });
    }

    // Sort by date
    data.sort((a, b) => a.date.localeCompare(b.date));

    return data;
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

}

