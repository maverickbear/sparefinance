/**
 * Investments Core Service
 * Business logic for essential investment features (Core tier)
 * 
 * SIMPLIFIED: This service handles only the core investment features:
 * - Investment Accounts
 * - Holdings básicos (ticker, quantity, avg price, current value)
 * - Investment Transactions simples (buy, sell, dividend)
 * - Portfolio Value calculation
 * 
 * Advanced features (Orders, Executions, Candles, Security Prices detalhados)
 * are in investments-advanced.service.ts
 */

import { InvestmentsRepository } from "@/src/infrastructure/database/repositories/investments.repository";
import { AccountsRepository } from "@/src/infrastructure/database/repositories/accounts.repository";
import { InvestmentsMapper } from "./investments.mapper";
import { InvestmentTransactionFormData } from "../../domain/investments/investments.validations";
import { BaseHolding, BaseInvestmentTransaction } from "../../domain/investments/investments.types";
import { getCurrentUserId } from "../shared/feature-guard";
import { formatTimestamp } from "@/src/infrastructure/utils/timestamp";
import { logger } from "@/src/infrastructure/utils/logger";
import { AppError } from "../shared/app-error";
import { mapClassToSector, normalizeAssetType } from "@/lib/utils/portfolio-utils";

export class InvestmentsCoreService {
  constructor(
    private repository: InvestmentsRepository,
    private accountsRepository: AccountsRepository
  ) {}

  /**
   * Get investment accounts
   * Core: List all investment accounts
   */
  async getInvestmentAccounts(
    accessToken?: string,
    refreshToken?: string
  ): Promise<Array<{ id: string; name: string; type: string; userId: string; householdId: string | null; createdAt: Date | string; updatedAt: Date | string }>> {
    try {
      const accounts = await this.repository.findInvestmentAccounts(accessToken, refreshToken);
      return accounts.map(account => ({
        id: account.id,
        name: account.name,
        type: account.type,
        userId: account.user_id,
        householdId: account.household_id,
        createdAt: account.created_at,
        updatedAt: account.updated_at,
      }));
    } catch (error) {
      logger.error("[InvestmentsCoreService] Error fetching investment accounts:", error);
      throw new AppError("Failed to fetch investment accounts", 500);
    }
  }

  /**
   * Get holdings (basic)
   * Core: Holdings básicos (ticker, quantity, avg price, current value)
   */
  async getHoldings(
    accountId?: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<BaseHolding[]> {
    const userId = await getCurrentUserId();
    if (!userId) {
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
   * Core: Basic calculation from buy/sell transactions
   */
  private async calculateHoldingsFromTransactions(
    accountId?: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<BaseHolding[]> {
    const userId = await getCurrentUserId();
    if (!userId) {
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
      const quantity = tx.quantity || 0;
      const price = tx.price || 0;

      if (tx.type === "buy") {
        // Calculate weighted average price
        const totalCost = holding.bookValue + (quantity * price);
        const totalQuantity = holding.quantity + quantity;
        holding.quantity = totalQuantity;
        holding.avgPrice = totalQuantity > 0 ? totalCost / totalQuantity : 0;
        holding.bookValue = totalCost;
      } else if (tx.type === "sell") {
        // Reduce quantity (FIFO - simple approach)
        holding.quantity = Math.max(0, holding.quantity - quantity);
        // Adjust book value proportionally
        if (holding.quantity > 0) {
          holding.bookValue = holding.bookValue * (holding.quantity / (holding.quantity + quantity));
        } else {
          holding.bookValue = 0;
          holding.avgPrice = 0;
        }
      }

      // Update current price (use last transaction price as approximation)
      if (price > 0) {
        holding.lastPrice = price;
        holding.marketValue = holding.quantity * price;
        holding.unrealizedPnL = holding.marketValue - holding.bookValue;
        holding.unrealizedPnLPercent = holding.bookValue > 0
          ? (holding.unrealizedPnL / holding.bookValue) * 100
          : 0;
      }
    }

    return Array.from(holdingKeyMap.values()).filter(h => h.quantity > 0);
  }

  /**
   * Get investment transactions
   * Core: Basic CRUD for investment transactions
   */
  async getTransactions(
    filters?: {
      accountId?: string;
      securityId?: string;
      startDate?: Date;
      endDate?: Date;
    },
    accessToken?: string,
    refreshToken?: string
  ): Promise<BaseInvestmentTransaction[]> {
    const rows = await this.repository.findTransactions(filters, accessToken, refreshToken);
    return rows.map(row => InvestmentsMapper.transactionToDomain(row));
  }

  /**
   * Create investment transaction
   * Core: Create buy/sell/dividend/interest transactions
   */
  async createTransaction(
    data: InvestmentTransactionFormData,
    accessToken?: string,
    refreshToken?: string
  ): Promise<BaseInvestmentTransaction> {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    const now = formatTimestamp(new Date());
    const row = await this.repository.createTransaction({
      id: crypto.randomUUID(),
      date: typeof data.date === 'string' ? data.date : formatTimestamp(data.date),
      accountId: data.accountId,
      securityId: data.securityId ?? null,
      type: data.type,
      quantity: data.quantity ?? null,
      price: data.price ?? null,
      fees: data.fees ?? 0,
      notes: data.notes ?? null,
      createdAt: now,
      updatedAt: now,
    });

    return InvestmentsMapper.transactionToDomain(row);
  }

  /**
   * Get portfolio value
   * Core: Simple aggregation of holdings values
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
   * Core: Calculate total value from investment accounts
   */
  async getTotalInvestmentsValue(): Promise<number> {
    const userId = await getCurrentUserId();
    if (!userId) {
      return 0;
    }

    try {
      const { createServerClient } = await import("@/src/infrastructure/database/supabase-server");
      const supabase = await createServerClient();

      // Get all investment accounts (type = "investment")
      const { data: investmentAccounts, error: accountsError } = await supabase
        .from("accounts")
        .select("id")
        .eq("type", "investment");

      if (accountsError || !investmentAccounts || investmentAccounts.length === 0) {
        if (accountsError?.code === '42501' || accountsError?.message?.includes('permission denied')) {
          logger.warn("[InvestmentsCoreService] Permission denied fetching investment accounts");
          return 0;
        }
        return 0;
      }

      const accountIds = investmentAccounts.map((acc) => acc.id);

      // Get stored values for these accounts
      const { data: storedValues } = await supabase
        .from("account_investment_values")
        .select("accountId, totalValue")
        .in("accountId", accountIds);

      // Get all entries for these accounts
      const { data: entries } = await supabase
        .from("simple_investment_entries")
        .select("accountId, type, amount")
        .in("accountId", accountIds);

      // Calculate total value for each account
      let totalValue = 0;

      for (const account of investmentAccounts) {
        const storedValue = storedValues?.find(v => v.accountId === account.id);
        if (storedValue && storedValue.totalValue) {
          totalValue += storedValue.totalValue;
          continue;
        }

        // Calculate from entries
        const accountEntries = entries?.filter(e => e.accountId === account.id) || [];
        const accountValue = accountEntries.reduce((sum, entry) => {
          if (entry.type === "buy" || entry.type === "deposit") {
            return sum + (entry.amount || 0);
          } else if (entry.type === "sell" || entry.type === "withdrawal") {
            return sum - (entry.amount || 0);
          }
          return sum;
        }, 0);

        totalValue += accountValue;
      }

      return totalValue;
    } catch (error) {
      logger.error("[InvestmentsCoreService] Error calculating total investments value:", error);
      return 0;
    }
  }
}
