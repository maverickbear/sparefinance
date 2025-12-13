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
      securityId: position.security_id,
      symbol: security?.symbol || "",
      name: security?.name || security?.symbol || "",
      assetType,
      sector,
      quantity: position.open_quantity || 0,
      avgPrice: position.average_entry_price || 0,
      bookValue: position.total_cost || 0,
      lastPrice: position.current_price || 0,
      marketValue: position.current_market_value || 0,
      unrealizedPnL: position.open_pnl || 0,
      unrealizedPnLPercent: position.total_cost > 0 
        ? ((position.open_pnl || 0) / position.total_cost) * 100 
        : 0,
      accountId: position.account_id,
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
      securityId: row.security_id,
      accountId: row.account_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
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
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
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
      securityId: row.security_id,
      date: new Date(row.date),
      price: row.price,
      createdAt: new Date(row.created_at),
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
      security_id: domain.securityId ?? null,
      account_id: domain.accountId,
    };
  }
}

