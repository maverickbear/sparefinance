/**
 * Market Data Client (Mock)
 * Fetches current market prices for securities
 * This is a mock implementation - replace with actual market data API (Alpha Vantage, Yahoo Finance, etc.)
 */

import { logger } from "@/src/infrastructure/utils/logger";

export interface MarketDataClientConfig {
  apiKey?: string;
  baseUrl?: string;
}

export class MarketDataClient {
  private config: MarketDataClientConfig;
  private priceCache: Map<string, { price: number; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

  constructor(config: MarketDataClientConfig = {}) {
    this.config = config;
  }

  /**
   * Fetch current price for a symbol
   * Mock implementation - returns random prices
   */
  async fetchPrice(symbol: string): Promise<number> {
    logger.info("[MarketDataClient] Fetching price for symbol (mock)", { symbol });

    // Check cache first
    const cached = this.priceCache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      logger.debug("[MarketDataClient] Using cached price", { symbol, price: cached.price });
      return cached.price;
    }

    // Mock implementation - replace with actual API call
    // Example: const response = await fetch(`${this.config.baseUrl}/quote?symbol=${symbol}`);
    // const data = await response.json();
    // return data.price;

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 200));

    // Mock prices (randomized for demo)
    const mockPrices: Record<string, number> = {
      AAPL: 175.50,
      TSLA: 250.00,
      VTI: 220.00,
      SPY: 450.00,
      BTC: 45000.00,
      ETH: 2500.00,
    };

    const price = mockPrices[symbol] || Math.random() * 100 + 50;

    // Update cache
    this.priceCache.set(symbol, {
      price,
      timestamp: Date.now(),
    });

    return price;
  }

  /**
   * Fetch prices for multiple symbols in batch
   */
  async fetchPrices(symbols: string[]): Promise<Map<string, number>> {
    logger.info("[MarketDataClient] Fetching prices for symbols (mock)", {
      count: symbols.length,
      symbols,
    });

    const prices = new Map<string, number>();

    // Fetch prices in parallel (with rate limiting in real implementation)
    await Promise.all(
      symbols.map(async (symbol) => {
        const price = await this.fetchPrice(symbol);
        prices.set(symbol, price);
      })
    );

    return prices;
  }

  /**
   * Clear price cache
   */
  clearCache(): void {
    this.priceCache.clear();
    logger.debug("[MarketDataClient] Price cache cleared");
  }
}
