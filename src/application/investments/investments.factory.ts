/**
 * Investments Factory
 * Dependency injection factory for InvestmentsService
 */

import { InvestmentsService } from "./investments.service";
import { InvestmentsRefreshService } from "./investments-refresh.service";
import { InvestmentsRepository } from "@/src/infrastructure/database/repositories/investments.repository";
import { AccountsRepository } from "@/src/infrastructure/database/repositories/accounts.repository";

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
  const marketDataClient = new MarketDataClient({
    apiKey: process.env.MARKET_DATA_API_KEY,
    baseUrl: process.env.MARKET_DATA_BASE_URL,
  });
  return new InvestmentsRefreshService(repository, marketDataClient);
}

