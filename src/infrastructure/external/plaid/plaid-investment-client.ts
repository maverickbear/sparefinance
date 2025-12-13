/**
 * Plaid Investment Client
 * Fetches investment account data from Plaid
 * Phase D: Real implementation using Plaid API
 */

import { PlaidInvestmentAccount } from "@/src/domain/investments/investments.types";
import { logger } from "@/src/infrastructure/utils/logger";
import { getAccounts, getHoldings } from "./plaid-client";
import { PlaidAccount, PlaidHolding } from "@/src/domain/plaid/plaid.types";

export interface PlaidInvestmentClientConfig {
  clientId?: string;
  secret?: string;
  environment?: "sandbox" | "development" | "production";
}

export class PlaidInvestmentClient {
  private config: PlaidInvestmentClientConfig;

  constructor(config: PlaidInvestmentClientConfig = {}) {
    this.config = config;
  }

  /**
   * Fetch investment accounts from Plaid
   * Phase D: Real implementation using Plaid API
   */
  async fetchInvestmentAccounts(
    accessToken: string
  ): Promise<PlaidInvestmentAccount[]> {
    logger.info("[PlaidInvestmentClient] Fetching investment accounts from Plaid");

    try {
      // Get all accounts
      const accounts = await getAccounts(accessToken);

      // Filter only investment accounts
      const investmentAccounts = accounts.filter(
        (account) => account.type === "investment"
      );

      if (investmentAccounts.length === 0) {
        logger.info("[PlaidInvestmentClient] No investment accounts found");
        return [];
      }

      // Get holdings and securities for all investment accounts
      const { holdings, securities } = await getHoldings(accessToken);

      // Group holdings by account
      const holdingsByAccount = new Map<string, PlaidHolding[]>();
      for (const holding of holdings) {
        const accountHoldings = holdingsByAccount.get(holding.accountId) || [];
        accountHoldings.push(holding);
        holdingsByAccount.set(holding.accountId, accountHoldings);
      }

      // Map to PlaidInvestmentAccount format
      const result: PlaidInvestmentAccount[] = investmentAccounts.map(
        (account) => {
          const accountHoldings = holdingsByAccount.get(account.accountId) || [];

          // Map holdings to the expected format
          const mappedHoldings = accountHoldings.map((holding) => {
            // Get security info for symbol
            const security = holding.securityId
              ? securities.get(holding.securityId)
              : null;
            const symbol = security?.tickerSymbol || holding.securityId || "UNKNOWN";

            return {
              symbol,
              quantity: holding.quantity,
              averagePrice: holding.costBasis && holding.quantity > 0
                ? holding.costBasis / holding.quantity
                : 0,
              currentPrice: holding.institutionPrice || null,
            };
          });

          // Calculate total balance (cash + holdings value)
          const holdingsValue = accountHoldings.reduce((sum, holding) => {
            const price = holding.institutionPrice || 0;
            return sum + holding.quantity * price;
          }, 0);

          const cash = account.balances.available || 0;
          const balance = cash + holdingsValue;

          return {
            accountId: account.accountId,
            name: account.name,
            balance,
            cash,
            holdings: mappedHoldings,
            recentActivity: [], // Will be populated from transactions if needed
          };
        }
      );

      logger.info("[PlaidInvestmentClient] Fetched investment accounts", {
        count: result.length,
      });

      return result;
    } catch (error: any) {
      logger.error("[PlaidInvestmentClient] Error fetching investment accounts", {
        error: error?.message || "Unknown error",
        errorType: error?.response?.data?.error_type,
        errorCode: error?.response?.data?.error_code,
      });
      throw error;
    }
  }

  /**
   * Fetch recent investment transactions from Plaid
   * Mock implementation
   */
  async fetchRecentTransactions(
    accessToken: string,
    accountIds: string[],
    days: number = 30
  ): Promise<Array<{
    accountId: string;
    type: "dividend" | "contribution" | "trade";
    date: Date;
    amount: number;
    description: string;
  }>> {
    logger.info("[PlaidInvestmentClient] Fetching recent transactions (mock)", {
      accountIds,
      days,
    });

    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 300));

    return [
      {
        accountId: "mock-account-1",
        type: "dividend",
        date: new Date(),
        amount: 125.00,
        description: "AAPL Dividend",
      },
    ];
  }
}
