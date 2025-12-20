/**
 * Plaid Mapper
 * Maps between domain entities and infrastructure DTOs
 * Handles mapping of Plaid API responses to domain types
 */

import { PlaidItem, PlaidItemStatus, PlaidTransaction } from '@/src/domain/plaid/plaid.types';
import { PlaidItemRow } from '@/src/infrastructure/database/repositories/plaid-items.repository';
import { BaseTransaction } from '@/src/domain/transactions/transactions.types';
import { PLAID_ITEM_STATUS } from '@/src/domain/plaid/plaid.constants';

export class PlaidMapper {
  /**
   * Map repository row to domain entity
   */
  static toDomain(row: PlaidItemRow): PlaidItem {
    // Map status to controlled value
    const status = this.mapStatus(row.status);

    return {
      id: row.id,
      userId: row.user_id,
      itemId: row.item_id,
      accessTokenEncrypted: row.access_token_encrypted,
      institutionId: row.institution_id,
      institutionName: row.institution_name,
      status,
      errorCode: row.error_code,
      errorMessage: row.error_message,
      consentExpiresAt: row.consent_expires_at,
      lastSuccessfulUpdate: row.last_successful_update,
      isSyncing: row.is_syncing,
      syncStartedAt: row.sync_started_at,
      transactionsCursor: row.transactions_cursor ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Map domain entity to repository row
   */
  static toRepository(domain: Partial<PlaidItem>): Partial<PlaidItemRow> {
    return {
      id: domain.id,
      user_id: domain.userId,
      item_id: domain.itemId,
      access_token_encrypted: domain.accessTokenEncrypted,
      institution_id: domain.institutionId ?? null,
      institution_name: domain.institutionName ?? null,
      status: domain.status || 'good',
      error_code: domain.errorCode ?? null,
      error_message: domain.errorMessage ?? null,
      consent_expires_at: domain.consentExpiresAt
        ? (domain.consentExpiresAt instanceof Date
            ? domain.consentExpiresAt.toISOString()
            : domain.consentExpiresAt)
        : null,
      last_successful_update: domain.lastSuccessfulUpdate
        ? (domain.lastSuccessfulUpdate instanceof Date
            ? domain.lastSuccessfulUpdate.toISOString()
            : domain.lastSuccessfulUpdate)
        : null,
      is_syncing: domain.isSyncing ?? false,
      sync_started_at: domain.syncStartedAt
        ? (domain.syncStartedAt instanceof Date
            ? domain.syncStartedAt.toISOString()
            : domain.syncStartedAt)
        : null,
      transactions_cursor: domain.transactionsCursor ?? null,
      created_at: domain.createdAt
        ? (domain.createdAt instanceof Date
            ? domain.createdAt.toISOString()
            : domain.createdAt)
        : new Date().toISOString(),
      updated_at: domain.updatedAt
        ? (domain.updatedAt instanceof Date
            ? domain.updatedAt.toISOString()
            : domain.updatedAt)
        : new Date().toISOString(),
    };
  }

  /**
   * Map Plaid API status to controlled domain status
   * Status is never free-form - always mapped to controlled values
   */
  static mapStatus(status: string | null | undefined): PlaidItemStatus {
    if (!status) {
      return 'good';
    }

    // Normalize status to lowercase
    const normalizedStatus = status.toLowerCase().trim();

    // Map common Plaid statuses to controlled values
    const statusMap: Record<string, PlaidItemStatus> = {
      'good': 'good',
      'item_login_required': 'item_login_required',
      'error': 'error',
      'pending_expiration': 'pending_expiration',
      'pending_metadata_update': 'pending_metadata_update',
    };

    // Return mapped status or default to 'error' if unknown
    return statusMap[normalizedStatus] || 'error';
  }

  /**
   * Map Plaid error code to controlled value
   */
  static mapErrorCode(errorCode: string | null | undefined): string | null {
    if (!errorCode) {
      return null;
    }

    // Normalize to uppercase (Plaid error codes are typically uppercase)
    return errorCode.toUpperCase().trim();
  }

  /**
   * Map Plaid transaction to domain transaction
   * Handles mapping of Plaid transaction data to our transaction format
   * 
   * Plaid amount convention:
   * - Positive values = outflows (expenses) - money leaving the account
   * - Negative values = inflows (income) - money entering the account
   */
  static plaidTransactionToDomain(
    plaidTx: PlaidTransaction,
    accountId: string, // Our internal account ID (not Plaid's account_id)
    userId: string,
    householdId: string | null
  ): Partial<BaseTransaction> {
    // Determine transaction type based on amount
    // Positive = expense (outflow), Negative = income (inflow)
    const type: 'income' | 'expense' | 'transfer' = plaidTx.amount >= 0 ? 'expense' : 'income';

    // Map Plaid category to our category (simplified - will be enhanced later)
    // For now, we'll use the primary category if available
    const categoryId = null; // Will be mapped in future phases
    const subcategoryId = null; // Will be mapped in future phases

    return {
      date: typeof plaidTx.date === 'string' ? plaidTx.date : plaidTx.date.toISOString().split('T')[0],
      type,
      amount: Math.abs(plaidTx.amount), // Store as positive, type indicates direction
      accountId,
      categoryId,
      subcategoryId,
      description: plaidTx.name || plaidTx.merchantName || 'Transaction',
      descriptionSearch: (plaidTx.name || plaidTx.merchantName || 'Transaction').toLowerCase(),
      isRecurring: false, // Will be detected later
      expenseType: null,
      userId,
      householdId,
      // Store Plaid transaction ID for deduplication (will be set separately)
    };
  }
}
