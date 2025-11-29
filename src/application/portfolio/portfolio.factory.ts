/**
 * Portfolio Factory
 * Dependency injection factory for PortfolioService
 */

import { PortfolioService } from "./portfolio.service";

/**
 * Create a PortfolioService instance with all dependencies
 */
export function makePortfolioService(): PortfolioService {
  return new PortfolioService();
}

