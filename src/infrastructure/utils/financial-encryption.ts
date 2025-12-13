/**
 * Financial Data Encryption
 * 
 * @deprecated This module is NOT USED. After analysis, we determined that encrypting
 * transaction amounts is not necessary for our use case. The system already has:
 * - Row Level Security (RLS) at database level
 * - Ownership verification in all endpoints
 * - Encryption at rest (Supabase)
 * - TLS for data transmission
 * 
 * Field-level encryption would add complexity and performance overhead without
 * proportional security benefit. See docs/FINANCIAL_ENCRYPTION_IMPLEMENTATION.md
 * for the full decision document.
 * 
 * This file is kept for reference only and may be removed in the future.
 * 
 * Architecture (if needed in future):
 * - Uses KMS (AWS KMS, Google Cloud KMS, or HashiCorp Vault) when configured
 * - Falls back to AES-256-GCM with ENCRYPTION_KEY if KMS is not available
 * - Supports migration from unencrypted to encrypted data
 */

import { logger } from './logger';
import { encrypt as encryptWithKey, decrypt as decryptWithKey, isEncryptionConfigured } from './encryption';

/**
 * KMS Provider Interface
 * Implement this interface for different KMS providers (AWS, Google Cloud, HashiCorp Vault)
 */
export interface KMSProvider {
  /**
   * Encrypt data using KMS
   */
  encrypt(data: string): Promise<string>;
  
  /**
   * Decrypt data using KMS
   */
  decrypt(encryptedData: string): Promise<string>;
  
  /**
   * Check if KMS is properly configured
   */
  isConfigured(): boolean;
}

/**
 * Fallback KMS Provider using ENCRYPTION_KEY
 * Uses the existing encryption infrastructure as fallback
 */
class FallbackKMSProvider implements KMSProvider {
  isConfigured(): boolean {
    return isEncryptionConfigured();
  }

  async encrypt(data: string): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('Encryption key not configured. Set ENCRYPTION_KEY environment variable.');
    }
    return encryptWithKey(data);
  }

  async decrypt(encryptedData: string): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('Encryption key not configured. Set ENCRYPTION_KEY environment variable.');
    }
    return decryptWithKey(encryptedData);
  }
}

/**
 * Get the configured KMS provider
 * Currently uses fallback provider, but can be extended to support AWS KMS, Google Cloud KMS, etc.
 */
function getKMSProvider(): KMSProvider {
  // Check for AWS KMS configuration
  if (process.env.AWS_KMS_KEY_ID) {
    // TODO: Implement AWS KMS provider
    logger.warn('[FinancialEncryption] AWS KMS configuration detected but not implemented. Using fallback.');
  }

  // Check for Google Cloud KMS configuration
  if (process.env.GOOGLE_CLOUD_KMS_KEY_NAME) {
    // TODO: Implement Google Cloud KMS provider
    logger.warn('[FinancialEncryption] Google Cloud KMS configuration detected but not implemented. Using fallback.');
  }

  // Check for HashiCorp Vault configuration
  if (process.env.VAULT_ADDR && process.env.VAULT_TRANSIT_KEY_NAME) {
    // TODO: Implement HashiCorp Vault provider
    logger.warn('[FinancialEncryption] HashiCorp Vault configuration detected but not implemented. Using fallback.');
  }

  // Use fallback provider (ENCRYPTION_KEY)
  return new FallbackKMSProvider();
}

let kmsProvider: KMSProvider | null = null;

/**
 * Get or initialize KMS provider (lazy initialization)
 */
function getProvider(): KMSProvider {
  if (!kmsProvider) {
    kmsProvider = getKMSProvider();
  }
  return kmsProvider;
}

/**
 * Encrypt a financial amount
 * Amounts are stored as encrypted strings in the database
 * 
 * @param amount - The numeric amount to encrypt
 * @returns Encrypted string representation of the amount
 */
export async function encryptAmount(amount: number | null): Promise<string | null> {
  if (amount === null || amount === undefined) {
    return null;
  }

  // Validate amount
  if (!isFinite(amount) || isNaN(amount)) {
    logger.warn('[FinancialEncryption] Invalid amount (NaN or Infinity):', amount);
    return null;
  }

  const MAX_REASONABLE_AMOUNT = 1_000_000_000_000; // 1 trillion
  if (Math.abs(amount) > MAX_REASONABLE_AMOUNT) {
    logger.warn('[FinancialEncryption] Amount is unreasonably large:', amount);
    return null;
  }

  try {
    const provider = getProvider();
    
    if (!provider.isConfigured()) {
      logger.error('[FinancialEncryption] KMS provider not configured. Cannot encrypt amount.');
      throw new Error('Encryption not configured. Set ENCRYPTION_KEY or configure KMS.');
    }

    // Convert amount to string with high precision
    const amountString = amount.toFixed(10);
    
    // Encrypt using KMS provider
    const encrypted = await provider.encrypt(amountString);
    
    // Prefix with "enc:" to identify encrypted values during migration
    return `enc:${encrypted}`;
  } catch (error) {
    logger.error('[FinancialEncryption] Error encrypting amount:', error);
    throw new Error(`Failed to encrypt amount: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decrypt a financial amount
 * Supports both encrypted strings and plain numbers (for migration compatibility)
 * 
 * @param encryptedAmount - The encrypted amount string or plain number
 * @returns The decrypted numeric amount, or null if invalid
 */
export async function decryptAmount(encryptedAmount: string | number | null): Promise<number | null> {
  if (encryptedAmount === null || encryptedAmount === undefined) {
    return null;
  }

  // If it's already a number, return it (unencrypted format or already decrypted)
  if (typeof encryptedAmount === 'number') {
    if (!isFinite(encryptedAmount) || isNaN(encryptedAmount)) {
      logger.warn('[FinancialEncryption] Invalid amount (NaN or Infinity):', encryptedAmount);
      return null;
    }
    return encryptedAmount;
  }

  // If it's a string but doesn't start with "enc:", it might be a plain number string
  if (!encryptedAmount.startsWith('enc:')) {
    const numericValue = parseFloat(encryptedAmount);
    if (!isNaN(numericValue) && isFinite(numericValue)) {
      return numericValue;
    }
    // If it's not a valid number, it might be corrupted data
    logger.warn('[FinancialEncryption] Amount string is not encrypted and not a valid number:', encryptedAmount);
    return null;
  }

  // Extract encrypted data (remove "enc:" prefix)
  const encryptedData = encryptedAmount.slice(4);

  try {
    const provider = getProvider();
    
    if (!provider.isConfigured()) {
      logger.error('[FinancialEncryption] KMS provider not configured. Cannot decrypt amount.');
      throw new Error('Encryption not configured. Set ENCRYPTION_KEY or configure KMS.');
    }

    // Decrypt using KMS provider
    const decryptedString = await provider.decrypt(encryptedData);
    
    // Parse back to number
    const amount = parseFloat(decryptedString);
    
    if (isNaN(amount) || !isFinite(amount)) {
      logger.error('[FinancialEncryption] Decrypted amount is not a valid number:', decryptedString);
      return null;
    }

    return amount;
  } catch (error) {
    logger.error('[FinancialEncryption] Error decrypting amount:', error);
    // During migration, if decryption fails, try to parse as plain number
    const fallback = parseFloat(encryptedAmount);
    if (!isNaN(fallback) && isFinite(fallback)) {
      logger.warn('[FinancialEncryption] Decryption failed, using fallback parsing:', encryptedAmount);
      return fallback;
    }
    return null;
  }
}

/**
 * Batch encrypt amounts
 */
export async function encryptAmountBatch(amounts: Array<number | null>): Promise<Array<string | null>> {
  return Promise.all(amounts.map(amount => encryptAmount(amount)));
}

/**
 * Batch decrypt amounts
 */
export async function decryptAmountBatch(
  encryptedAmounts: Array<string | number | null>
): Promise<Array<number | null>> {
  return Promise.all(encryptedAmounts.map(amount => decryptAmount(amount)));
}

/**
 * Check if financial encryption is configured
 */
export function isFinancialEncryptionConfigured(): boolean {
  try {
    const provider = getProvider();
    return provider.isConfigured();
  } catch {
    return false;
  }
}

