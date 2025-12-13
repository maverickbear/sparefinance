/**
 * Investments Advanced Service
 * Business logic for advanced investment features (Advanced tier)
 * 
 * SIMPLIFIED: This service handles advanced/complex investment features that require
 * feature flags or are computationally expensive:
 * - Security Prices detalhados (historical prices, bulk updates)
 * - Advanced P&L calculations
 * - Orders tracking (future)
 * - Executions tracking (future)
 * - Candles/historical prices (future)
 * 
 * Core features (Accounts, Holdings básicos, Transactions simples, Portfolio Value)
 * are in investments-core.service.ts
 */

import { InvestmentsRepository } from "@/src/infrastructure/database/repositories/investments.repository";
import { InvestmentsMapper } from "./investments.mapper";
import { SecurityPriceFormData } from "../../domain/investments/investments.validations";
import { BaseSecurity, BaseSecurityPrice } from "../../domain/investments/investments.types";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { formatTimestamp } from "@/src/infrastructure/utils/timestamp";
import { getCurrentUserId } from "../shared/feature-guard";
import { guardFeatureAccessReadOnly } from "../shared/feature-guard";
import { logger } from "@/src/infrastructure/utils/logger";
import { AppError } from "../shared/app-error";
import crypto from "crypto";
import { ENABLE_INVESTMENTS_ADVANCED } from "@/src/domain/shared/feature-flags";

export class InvestmentsAdvancedService {
  constructor(
    private repository: InvestmentsRepository
  ) {}

  /**
   * Check if advanced features are enabled
   */
  private async checkFeatureAccess(userId: string): Promise<void> {
    if (!ENABLE_INVESTMENTS_ADVANCED) {
      throw new AppError("Advanced investment features are not enabled", 403);
    }

    const featureGuard = await guardFeatureAccessReadOnly(userId, "hasInvestments");
    if (!featureGuard.allowed) {
      throw new AppError("Investments feature not available", 403);
    }
  }

  /**
   * Get security prices (Advanced)
   * Detailed historical price tracking
   */
  async getSecurityPrices(
    userId: string,
    securityId?: string
  ): Promise<BaseSecurityPrice[]> {
    await this.checkFeatureAccess(userId);

    const prices = await this.repository.findSecurityPrices(securityId);
    
    // Fetch securities if needed
    const securityIds = new Set(prices.map(p => p.security_id));
    const supabase = await createServerClient();
    const { data: securities } = await supabase
      .from("securities")
      .select("*")
      .in("id", Array.from(securityIds));

    const securityMap = new Map((securities || []).map(s => InvestmentsMapper.securityToDomain(s)).map(s => [s.id, s]));

    return prices.map(price => {
      return InvestmentsMapper.securityPriceToDomain(price, securityMap.get(price.security_id));
    });
  }

  /**
   * Create security price (Advanced)
   * Add historical price data
   */
  async createSecurityPrice(
    userId: string,
    data: SecurityPriceFormData
  ): Promise<BaseSecurityPrice> {
    await this.checkFeatureAccess(userId);

    const id = crypto.randomUUID();
    const date = data.date instanceof Date ? data.date : new Date(data.date);
    const priceDate = formatTimestamp(date);
    const now = formatTimestamp(new Date());

    const priceRow = await this.repository.createSecurityPrice({
      id,
      securityId: data.securityId,
      date: priceDate,
      price: data.price,
      createdAt: now,
    });

    // Fetch security
    const supabase = await createServerClient();
    const { data: security } = await supabase
      .from("securities")
      .select("*")
      .eq("id", data.securityId)
      .single();

    return InvestmentsMapper.securityPriceToDomain(
      priceRow,
      security ? InvestmentsMapper.securityToDomain(security) : null
    );
  }

  /**
   * Update all security prices (Advanced)
   * Bulk update prices from external API
   */
  async updateAllSecurityPrices(
    userId: string
  ): Promise<{ updated: number; errors: string[] }> {
    await this.checkFeatureAccess(userId);

    try {
      const supabase = await createServerClient();
      
      // Get all securities
      const { data: securities, error: securitiesError } = await supabase
        .from("securities")
        .select("id, symbol");

      if (securitiesError || !securities) {
        throw new Error(`Failed to fetch securities: ${securitiesError?.message}`);
      }

      // TODO: Integrate with external price API (e.g., Alpha Vantage, Yahoo Finance)
      // For now, this is a placeholder that shows the structure
      const errors: string[] = [];
      let updated = 0;

      // Example: Fetch prices from external API
      // const prices = await fetchPricesFromAPI(securities.map(s => s.symbol));
      
      // For now, return empty result
      return { updated, errors };
    } catch (error) {
      logger.error("[InvestmentsAdvancedService] Error updating security prices:", error);
      throw new AppError(
        `Failed to update security prices: ${error instanceof Error ? error.message : "Unknown error"}`,
        500
      );
    }
  }

  /**
   * Get securities (Advanced)
   * Full security management
   */
  async getSecurities(userId: string): Promise<BaseSecurity[]> {
    await this.checkFeatureAccess(userId);

    const securities = await this.repository.findSecurities();
    return securities.map(s => InvestmentsMapper.securityToDomain(s));
  }

  /**
   * Create security (Advanced)
   * Add new security to database
   */
  async createSecurity(
    userId: string,
    data: { symbol: string; name: string; class: string }
  ): Promise<BaseSecurity> {
    await this.checkFeatureAccess(userId);

    const id = crypto.randomUUID();
    const now = formatTimestamp(new Date());
    const { normalizeAssetType } = await import("@/lib/utils/portfolio-utils");
    const normalizedClass = normalizeAssetType(data.class);

    const securityRow = await this.repository.createSecurity({
      id,
      symbol: data.symbol.toUpperCase(),
      name: data.name,
      class: normalizedClass,
      createdAt: now,
      updatedAt: now,
    });

    return InvestmentsMapper.securityToDomain(securityRow);
  }

  /**
   * Get advanced P&L calculations (Advanced)
   * Detailed profit and loss analysis
   * 
   * NOTE: This is a placeholder for future advanced P&L calculations.
   * Currently returns basic P&L, but structure is ready for tax lot tracking,
   * cost basis methods, etc.
   */
  async getAdvancedPnL(
    userId: string,
    accountId?: string
  ): Promise<{
    totalPnL: number;
    realizedPnL: number;
    unrealizedPnL: number;
    taxLots: Array<{
      securityId: string;
      quantity: number;
      costBasis: number;
      currentValue: number;
      pnl: number;
    }>;
  }> {
    await this.checkFeatureAccess(userId);

    // TODO: Implement advanced P&L calculations
    // For now, return basic structure
    return {
      totalPnL: 0,
      realizedPnL: 0,
      unrealizedPnL: 0,
      taxLots: [],
    };
  }
}
