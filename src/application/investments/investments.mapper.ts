/**
 * Investments Mapper
 * Maps between domain entities and infrastructure DTOs
 */

import { BaseHolding, BaseInvestmentTransaction, BaseSecurity, BaseSecurityPrice } from "../../domain/investments/investments.types";
import { InvestmentTransactionRow, SecurityRow, SecurityPriceRow, PositionRow } from "@/src/infrastructure/database/repositories/investments.repository";
import { mapClassToSector } from "@/lib/utils/portfolio-utils";

export class InvestmentsMapper {
  /**
   * Map position row to holding domain entity
   */
  static positionToHolding(
    position: PositionRow,
    security?: { id: string; symbol: string; name: string; class: string; sector: string | null } | null,
    account?: { id: string; name: string } | null
  ): BaseHolding {
    const assetType = security?.class || "Stock";
    const sector = security?.sector || mapClassToSector(assetType, security?.symbol || "");

    return {
      securityId: position.securityId,
      symbol: security?.symbol || "",
      name: security?.name || security?.symbol || "",
      assetType,
      sector,
      quantity: position.openQuantity || 0,
      avgPrice: position.averageEntryPrice || 0,
      bookValue: position.totalCost || 0,
      lastPrice: position.currentPrice || 0,
      marketValue: position.currentMarketValue || 0,
      unrealizedPnL: position.openPnl || 0,
      unrealizedPnLPercent: position.totalCost > 0 
        ? ((position.openPnl || 0) / position.totalCost) * 100 
        : 0,
      accountId: position.accountId,
      accountName: account?.name || "Unknown Account",
    };
  }

  /**
   * Map transaction row to domain entity
   */
  static transactionToDomain(
    row: InvestmentTransactionRow,
    relations?: {
      account?: { id: string; name: string; type: string } | null;
      security?: { id: string; symbol: string; name: string; class: string; sector: string | null } | null;
    }
  ): BaseInvestmentTransaction {
    return {
      id: row.id,
      date: new Date(row.date),
      type: row.type,
      quantity: row.quantity,
      price: row.price,
      fees: row.fees,
      notes: row.notes,
      securityId: row.securityId,
      accountId: row.accountId,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      account: relations?.account || null,
      security: relations?.security || null,
    };
  }

  /**
   * Map security row to domain entity
   */
  static securityToDomain(row: SecurityRow): BaseSecurity {
    return {
      id: row.id,
      symbol: row.symbol,
      name: row.name,
      class: row.class,
      sector: row.sector,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  /**
   * Map security price row to domain entity
   */
  static securityPriceToDomain(
    row: SecurityPriceRow,
    security?: BaseSecurity | null
  ): BaseSecurityPrice {
    return {
      id: row.id,
      securityId: row.securityId,
      date: new Date(row.date),
      price: row.price,
      createdAt: new Date(row.createdAt),
      security: security || null,
    };
  }

  /**
   * Map domain entity to transaction row
   */
  static transactionToRepository(domain: Partial<BaseInvestmentTransaction>): Partial<InvestmentTransactionRow> {
    return {
      id: domain.id,
      date: domain.date ? (typeof domain.date === 'string' ? domain.date : domain.date.toISOString().split('T')[0]) : undefined,
      type: domain.type,
      quantity: domain.quantity ?? null,
      price: domain.price ?? null,
      fees: domain.fees ?? 0,
      notes: domain.notes ?? null,
      securityId: domain.securityId ?? null,
      accountId: domain.accountId,
    };
  }
}

