/**
 * Investments Factory
 * Dependency injection factory for InvestmentsService
 */

import { InvestmentsService } from "./investments.service";
import { InvestmentsRefreshService } from "./investments-refresh.service";
import { InvestmentsRepository } from "@/src/infrastructure/database/repositories/investments.repository";
import { AccountsRepository } from "@/src/infrastructure/database/repositories/accounts.repository";
import { PlaidInvestmentClient } from "@/src/infrastructure/external/plaid/plaid-investment-client";
import { MarketDataClient } from "@/src/infrastructure/external/market-data/market-data-client";

/**
 * Create an InvestmentsService instance with all dependencies
 */
export function makeInvestmentsService(): InvestmentsService {
  const repository = new InvestmentsRepository();
  const accountsRepository = new AccountsRepository();
  return new InvestmentsService(repository, accountsRepository);
}

/**
 * Create an InvestmentsRefreshService instance with all dependencies
 */
export function makeInvestmentsRefreshService(): InvestmentsRefreshService {
  const repository = new InvestmentsRepository();
  const plaidClient = new PlaidInvestmentClient({
    // In production, load from environment variables
    clientId: process.env.PLAID_CLIENT_ID,
    secret: process.env.PLAID_SECRET,
    environment: (process.env.PLAID_ENV as "sandbox" | "development" | "production") || "sandbox",
  });
  const marketDataClient = new MarketDataClient({
    apiKey: process.env.MARKET_DATA_API_KEY,
    baseUrl: process.env.MARKET_DATA_BASE_URL,
  });
  return new InvestmentsRefreshService(repository, plaidClient, marketDataClient);
}

