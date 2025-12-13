/**
 * Transaction description utilities
 * Encryption has been removed - descriptions are stored as plain text
 */

import { logger } from './logger';

/**
 * Normalize transaction description for matching and search
 * - Convert to lowercase
 * - Remove special characters
 * - Trim and normalize whitespace
 * This function must be used consistently across:
 * - Backfill scripts
 * - createTransaction
 * - updateTransaction
 * - analytics.categoryLearning
 */
export function normalizeDescription(description: string | null | undefined): string {
  if (!description) return "";
  
  return description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Store transaction description (no encryption)
 * @deprecated Encryption removed - this function now just returns the description as-is
 */
export function encryptDescription(description: string | null): string | null {
  // Encryption removed - return description as-is
  return description;
}

/**
 * Store transaction amount (no encryption)
 * @deprecated Encryption removed - amounts are stored as numeric values
 */
export function encryptAmount(amount: number | null): string | null {
  // Encryption removed - amounts are stored as numbers, not strings
  // This function is kept for backward compatibility but should not be used
  if (amount === null || amount === undefined) return null;
  return amount.toString();
}

/**
 * Get transaction amount (no decryption needed)
 * @deprecated Encryption removed - amounts are stored as numbers
 */
export function decryptAmount(amount: string | number | null): number | null {
  if (amount === null || amount === undefined) return null;
  
  // If it's already a number, validate it before returning
  if (typeof amount === 'number') {
    if (!isFinite(amount) || isNaN(amount)) {
      logger.warn('Invalid amount (NaN or Infinity):', amount);
      return null;
    }
    const MAX_REASONABLE_AMOUNT = 1_000_000_000_000; // 1 trillion
    if (Math.abs(amount) > MAX_REASONABLE_AMOUNT) {
      logger.warn('Amount is unreasonably large, likely corrupted data:', amount);
      return null;
    }
    return amount;
  }
  
  // If it's a string, try to parse it
  const numericValue = parseFloat(amount);
  if (isNaN(numericValue) || !isFinite(numericValue)) {
    return null;
  }
  const MAX_REASONABLE_AMOUNT = 1_000_000_000_000; // 1 trillion
  if (Math.abs(numericValue) > MAX_REASONABLE_AMOUNT) {
    logger.warn('Parsed amount is unreasonably large, likely corrupted data:', numericValue);
    return null;
  }
  return numericValue;
}


/**
 * Get transaction amount (supports both numeric and encrypted during migration)
 * After migration, amounts will always be numeric, so this function will just return the value
 * @param amount - The amount value (can be number, encrypted string, or null)
 * @returns The numeric amount, or null if invalid
 */
export function getTransactionAmount(amount: string | number | null | undefined): number | null {
  if (amount === null || amount === undefined) return null;
  
  // If it's already a number, return it (new format after migration)
  if (typeof amount === 'number') {
    if (!isFinite(amount) || isNaN(amount)) {
      return null;
    }
    return amount;
  }
  
  // Otherwise, try to decrypt (old encrypted format during migration)
  return decryptAmount(amount);
}

/**
 * Batch process transaction amounts (no decryption needed)
 * @deprecated Encryption removed
 */
export function decryptAmountBatch(
  amounts: Array<string | number | null>
): Array<number | null> {
  return amounts.map(amount => decryptAmount(amount));
}

/**
 * Batch process transaction descriptions (no decryption needed)
 * @deprecated Encryption removed
 */
export function decryptDescriptionBatch(
  descriptions: Array<string | null>
): Array<string | null> {
  return descriptions.map(desc => decryptDescription(desc));
}

/**
 * Process transactions in batch (no decryption needed)
 * @deprecated Encryption removed
 */
export function decryptTransactionsBatch<T extends { amount: any; description?: any }>(
  transactions: T[]
): T[] {
  // No decryption needed - just return transactions as-is
  return transactions.map(tx => ({
    ...tx,
    amount: decryptAmount(tx.amount),
    description: tx.description ? decryptDescription(tx.description) : null,
  }));
}

/**
 * Get transaction description (no decryption needed)
 * @deprecated Encryption removed - descriptions are stored as plain text
 */
export function decryptDescription(description: string | null): string | null {
  // Encryption removed - return description as-is
  return description;
}

