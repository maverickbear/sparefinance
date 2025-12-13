/**
 * Investments Refresh Service
 * Handles automatic and manual refresh of investment data
 */

import { InvestmentsRepository } from "@/src/infrastructure/database/repositories/investments.repository";
import { PlaidInvestmentClient } from "@/src/infrastructure/external/plaid/plaid-investment-client";
import { MarketDataClient } from "@/src/infrastructure/external/market-data/market-data-client";
import {
  PortfolioSnapshot,
  PlaidInvestmentAccount,
} from "@/src/domain/investments/investments.types";
import { logger } from "@/src/infrastructure/utils/logger";
import { AppError } from "../shared/app-error";
import { formatTimestamp } from "@/src/infrastructure/utils/timestamp";

export class InvestmentsRefreshService {
  constructor(
    private repository: InvestmentsRepository,
    private plaidClient: PlaidInvestmentClient,
    private marketDataClient: MarketDataClient
  ) {}

  /**
   * Refresh investments from Plaid
   * Fetches accounts, updates balances, upserts holdings, logs sync time
   */
  async refreshInvestments(
    userId: string,
    accessToken: string
  ): Promise<PortfolioSnapshot> {
    logger.info("[InvestmentsRefreshService] Starting investment refresh", { userId });

    try {
      // Fetch accounts from Plaid
      const plaidAccounts = await this.plaidClient.fetchInvestmentAccounts(accessToken);

      if (plaidAccounts.length === 0) {
        logger.warn("[InvestmentsRefreshService] No accounts found from Plaid");
        return this.calculatePortfolioSnapshot(userId);
      }

      // Process each account
      for (const plaidAccount of plaidAccounts) {
        await this.processPlaidAccount(userId, plaidAccount);
      }

      // Return updated snapshot
      return this.calculatePortfolioSnapshot(userId);
    } catch (error) {
      logger.error("[InvestmentsRefreshService] Error refreshing investments:", error);
      throw new AppError(
        "Failed to refresh investments",
        500
      );
    }
  }

  /**
   * Process a single Plaid account
   */
  private async processPlaidAccount(
    userId: string,
    plaidAccount: PlaidInvestmentAccount
  ): Promise<void> {
    // Find or create investment account
    let investmentAccount = await this.findOrCreateInvestmentAccount(
      userId,
      plaidAccount.accountId,
      plaidAccount.name
    );

    // Update balance
    await this.repository.updateAccountBalance(investmentAccount.id, plaidAccount.balance);

    // Upsert holdings
    if (plaidAccount.holdings.length > 0) {
      await this.repository.upsertHoldings(
        userId,
        investmentAccount.id,
        plaidAccount.holdings.map((h) => ({
          symbol: h.symbol,
          quantity: h.quantity,
          averagePrice: h.averagePrice,
          currentPrice: h.currentPrice || 0, // Will be updated by refreshMarketPrices if null
        }))
      );
    }

    // Update sync timestamp
    await this.repository.updateAccountSyncTime(investmentAccount.id, new Date());
  }

  /**
   * Find or create investment account
   * Links Plaid account to investment_accounts table
   */
  private async findOrCreateInvestmentAccount(
    userId: string,
    plaidAccountId: string,
    name: string
  ): Promise<{ id: string }> {
    // In a real implementation, you would:
    // 1. Check if an investment_account exists with matching provider metadata
    // 2. If not, create a new account in the accounts table (type="investment")
    // 3. Create/update the investment_accounts record with account_id reference
    // 4. Store plaidAccountId in a metadata field or separate mapping table
    
    // For now, we'll use a simplified approach:
    // Generate a stable ID from plaidAccountId and check if investment_account exists
    const stableId = `plaid-${plaidAccountId}`;
    
    // Try to find existing investment_account by name and user_id
    // In production, you'd use a proper lookup by provider account ID
    const { createServerClient } = await import("@/src/infrastructure/database/supabase-server");
    const supabase = await createServerClient();
    
    const { data: existing } = await supabase
      .from("investment_accounts")
      .select("id")
      .eq("user_id", userId)
      .eq("name", name)
      .maybeSingle();
    
    if (existing) {
      return { id: existing.id };
    }
    
    // Create new investment_account
    // Note: In production, you'd also create the corresponding account in accounts table first
    const { data: newAccount, error } = await supabase
      .from("investment_accounts")
      .insert({
        id: stableId,
        user_id: userId,
        name,
        type: "investment",
        provider: "plaid",
        created_at: formatTimestamp(new Date()),
        updated_at: formatTimestamp(new Date()),
      })
      .select("id")
      .single();
    
    if (error) {
      logger.error("[InvestmentsRefreshService] Error creating investment account:", error);
      throw new AppError("Failed to create investment account", 500);
    }
    
    return { id: newAccount.id };
  }

  /**
   * Refresh market prices for holdings
   * Updates prices for holdings with old prices (older than 1 hour)
   */
  async refreshMarketPrices(userId: string): Promise<void> {
    logger.info("[InvestmentsRefreshService] Refreshing market prices", { userId });

    try {
      // Find all holdings
      const holdings = await this.repository.findHoldings(userId);

      if (holdings.length === 0) {
        logger.debug("[InvestmentsRefreshService] No holdings to update");
        return;
      }

      // Filter holdings that need price update (older than 1 hour or null)
      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;

      const holdingsToUpdate = holdings.filter((holding) => {
        if (!holding.last_price_update_at) return true;
        const lastUpdate = new Date(holding.last_price_update_at).getTime();
        return lastUpdate < oneHourAgo;
      });

      if (holdingsToUpdate.length === 0) {
        logger.debug("[InvestmentsRefreshService] No holdings need price update");
        return;
      }

      // Get unique symbols
      const symbols = [...new Set(holdingsToUpdate.map((h) => h.symbol))];

      // Fetch prices in batch
      const prices = await this.marketDataClient.fetchPrices(symbols);

      // Update holdings
      for (const holding of holdingsToUpdate) {
        const price = prices.get(holding.symbol);
        if (price !== undefined) {
          await this.repository.updateHoldingPrice(holding.id, price);
        }
      }

      logger.info("[InvestmentsRefreshService] Market prices refreshed", {
        updated: holdingsToUpdate.length,
      });
    } catch (error) {
      logger.error("[InvestmentsRefreshService] Error refreshing market prices:", error);
      throw new AppError("Failed to refresh market prices", 500);
    }
  }

  /**
   * Calculate portfolio snapshot
   * Returns total value, daily/monthly change, allocation breakdown, recent activity
   */
  async calculatePortfolioSnapshot(userId: string): Promise<PortfolioSnapshot> {
    logger.info("[InvestmentsRefreshService] Calculating portfolio snapshot", { userId });

    try {
      // Get all holdings
      const holdings = await this.repository.findHoldings(userId);

      // Get manual investments
      const manualInvestments = await this.repository.findManualInvestments(userId);

      // Calculate total value from holdings
      let totalValue = 0;
      const allocation = {
        equities: 0,
        etfs: 0,
        crypto: 0,
        cash: 0,
        other: 0,
      };

      for (const holding of holdings) {
        const marketValue = holding.quantity * holding.current_price;
        totalValue += marketValue;

        // Categorize by symbol prefix (simplified - in real implementation, use security class)
        const symbol = holding.symbol.toUpperCase();
        if (symbol === "BTC" || symbol === "ETH" || symbol.startsWith("CRYPTO")) {
          allocation.crypto += marketValue;
        } else if (symbol.startsWith("V") || symbol.startsWith("SPY") || symbol.includes("ETF")) {
          allocation.etfs += marketValue;
        } else {
          allocation.equities += marketValue;
        }
      }

      // Add manual investments
      for (const manual of manualInvestments) {
        totalValue += manual.current_value;
        allocation.other += manual.current_value;
      }

      // Calculate daily and monthly change (simplified - in real implementation, use historical data)
      const dailyChange = 0; // TODO: Calculate from historical data
      const dailyChangePercent = totalValue > 0 ? (dailyChange / totalValue) * 100 : 0;
      const monthlyChange = 0; // TODO: Calculate from historical data
      const monthlyChangePercent = totalValue > 0 ? (monthlyChange / totalValue) * 100 : 0;

      // Get recent activity (simplified - in real implementation, fetch from transactions)
      const recentActivity: PortfolioSnapshot["recentActivity"] = [];

      return {
        totalValue,
        dailyChange,
        dailyChangePercent,
        monthlyChange,
        monthlyChangePercent,
        allocation,
        recentActivity,
        lastUpdatedAt: formatTimestamp(new Date()),
      };
    } catch (error) {
      logger.error("[InvestmentsRefreshService] Error calculating portfolio snapshot:", error);
      throw new AppError("Failed to calculate portfolio snapshot", 500);
    }
  }

  /**
   * Refresh on app open
   * If last sync > 12h → run refreshInvestments
   * Always run refreshMarketPrices
   */
  async refreshOnOpen(
    userId: string,
    accessToken: string
  ): Promise<PortfolioSnapshot> {
    logger.info("[InvestmentsRefreshService] Refreshing on open", { userId });

    try {
      // Check if we need full refresh (last sync > 12 hours)
      // For now, we'll always do a full refresh if accessToken is provided
      // In a real implementation, check last_synced_at from investment_accounts

      if (accessToken) {
        const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000;
        // TODO: Check last_synced_at from investment_accounts
        // For now, always refresh
        await this.refreshInvestments(userId, accessToken);
      }

      // Always refresh market prices
      await this.refreshMarketPrices(userId);

      // Return final snapshot
      return this.calculatePortfolioSnapshot(userId);
    } catch (error) {
      logger.error("[InvestmentsRefreshService] Error refreshing on open:", error);
      // Return snapshot even if refresh fails
      return this.calculatePortfolioSnapshot(userId);
    }
  }
}
