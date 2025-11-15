/**
 * Encryption utilities for transaction descriptions and amounts
 * Uses the existing encryption library with backward compatibility for plain text data
 */

import { encrypt, decrypt } from './encryption';
import { logger } from './logger';

/**
 * Encrypt a transaction description before saving to database
 */
export function encryptDescription(description: string | null): string | null {
  if (!description) return null;
  try {
    return encrypt(description);
  } catch (error) {
    logger.error('Error encrypting description:', error);
    throw error;
  }
}

/**
 * Encrypt a transaction amount before saving to database
 * Amount is converted to string, encrypted, then stored as string
 */
export function encryptAmount(amount: number | null): string | null {
  if (amount === null || amount === undefined) return null;
  try {
    // Convert number to string with enough precision
    const amountString = amount.toString();
    return encrypt(amountString);
  } catch (error) {
    logger.error('Error encrypting amount:', error);
    throw error;
  }
}

/**
 * Decrypt a transaction amount when reading from database
 * If decryption fails, assumes it's plain text (backward compatibility with old data)
 */
export function decryptAmount(encryptedAmount: string | number | null): number | null {
  if (encryptedAmount === null || encryptedAmount === undefined) return null;
  
  // If it's already a number, validate it before returning
  if (typeof encryptedAmount === 'number') {
    // Validate that the number is finite and within reasonable bounds
    if (!isFinite(encryptedAmount) || isNaN(encryptedAmount)) {
      logger.warn('Invalid amount (NaN or Infinity):', encryptedAmount);
      return null;
    }
    // Validate that the amount is within reasonable bounds (max 1 trillion)
    const MAX_REASONABLE_AMOUNT = 1_000_000_000_000; // 1 trillion
    if (Math.abs(encryptedAmount) > MAX_REASONABLE_AMOUNT) {
      logger.warn('Amount is unreasonably large, likely corrupted data:', encryptedAmount);
      return null;
    }
    return encryptedAmount;
  }
  
  // If it's a string that looks like a number, try to parse it first (backward compatibility)
  const numericValue = parseFloat(encryptedAmount);
  if (!isNaN(numericValue) && isFinite(numericValue) && encryptedAmount.length < 50) {
    // Short string that parses to a number - likely unencrypted
    // Validate that the amount is within reasonable bounds
    const MAX_REASONABLE_AMOUNT = 1_000_000_000_000; // 1 trillion
    if (Math.abs(numericValue) > MAX_REASONABLE_AMOUNT) {
      logger.warn('Parsed amount is unreasonably large, likely corrupted data:', numericValue);
      return null;
    }
    return numericValue;
  }
  
  // Check if we're in a browser environment
  const isBrowser = typeof window !== 'undefined';
  
  // If in browser and Node.js crypto is not available, return as-is
  // The server API should handle decryption when fetching transactions
  if (isBrowser && !isNodeCryptoAvailable()) {
    // Try to parse as number if possible
    const parsed = parseFloat(encryptedAmount);
    if (isNaN(parsed) || !isFinite(parsed)) {
      return null;
    }
    // Validate that the amount is within reasonable bounds
    const MAX_REASONABLE_AMOUNT = 1_000_000_000_000; // 1 trillion
    if (Math.abs(parsed) > MAX_REASONABLE_AMOUNT) {
      logger.warn('Parsed amount in browser is unreasonably large:', parsed);
      return null;
    }
    return parsed;
  }
  
  // Check if the text looks like encrypted data
  // Encrypted data format: salt (128 hex chars) + iv (32 hex chars) + tag (32 hex chars) + encrypted data
  // Minimum length: (64 + 16 + 16) * 2 = 192 hex characters
  const MIN_ENCRYPTED_LENGTH = 192;
  const isHexString = /^[0-9a-f]+$/i.test(encryptedAmount);
  
  // If it's too short or doesn't look like hex, try to parse as number
  if (encryptedAmount.length < MIN_ENCRYPTED_LENGTH || !isHexString) {
    const parsed = parseFloat(encryptedAmount);
    if (isNaN(parsed) || !isFinite(parsed)) {
      return null;
    }
    // Validate that the amount is within reasonable bounds
    const MAX_REASONABLE_AMOUNT = 1_000_000_000_000; // 1 trillion
    if (Math.abs(parsed) > MAX_REASONABLE_AMOUNT) {
      logger.warn('Parsed amount is unreasonably large, likely corrupted data:', parsed);
      return null;
    }
    return parsed;
  }
  
  // Try to decrypt - if it fails, assume it's plain text (backward compatibility)
  try {
    const decryptedString = decrypt(encryptedAmount, true); // silent mode
    const decryptedNumber = parseFloat(decryptedString);
    if (isNaN(decryptedNumber) || !isFinite(decryptedNumber)) {
      logger.warn('Decrypted amount is not a valid number:', decryptedString);
      return null;
    }
    // Validate that the amount is within reasonable bounds (max 1 trillion)
    // This prevents corrupted data from causing display issues
    const MAX_REASONABLE_AMOUNT = 1_000_000_000_000; // 1 trillion
    if (Math.abs(decryptedNumber) > MAX_REASONABLE_AMOUNT) {
      logger.warn('Decrypted amount is unreasonably large, likely corrupted data:', {
        amount: decryptedNumber,
        encryptedValue: encryptedAmount.substring(0, 100) + '...',
      });
      return null;
    }
    return decryptedNumber;
  } catch (error) {
    // If decryption fails, try to parse as number (old data)
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // If the string looks like encrypted data (long hex string), don't try to parse it
    // Encrypted data format: salt (128 hex chars) + iv (32 hex chars) + tag (32 hex chars) + encrypted data
    const MIN_ENCRYPTED_LENGTH = 192;
    const isHexString = /^[0-9a-f]+$/i.test(encryptedAmount);
    if (encryptedAmount.length >= MIN_ENCRYPTED_LENGTH && isHexString) {
      // This looks like encrypted data but decryption failed
      // Don't try to parse it as a number - return null
      if (!isBrowser) {
        logger.warn('Failed to decrypt amount (encrypted data), returning null:', errorMessage.substring(0, 100));
      }
      return null;
    }
    
    if (errorMessage.includes('ENCRYPTION_KEY')) {
      // Missing encryption key - try to parse as number only if it doesn't look encrypted
      const parsed = parseFloat(encryptedAmount);
      if (isNaN(parsed) || !isFinite(parsed)) {
        return null;
      }
      // Validate that the amount is within reasonable bounds
      const MAX_REASONABLE_AMOUNT = 1_000_000_000_000; // 1 trillion
      if (Math.abs(parsed) > MAX_REASONABLE_AMOUNT) {
        logger.warn('Parsed amount (missing key) is unreasonably large, likely corrupted:', parsed);
        return null;
      }
      return parsed;
    }
    if (!isBrowser) {
      logger.warn('Failed to decrypt amount, treating as plain text:', errorMessage.substring(0, 100));
    }
    // Try to parse as number only if it's a short string that might be unencrypted
    // Long strings are likely encrypted data that failed to decrypt
    if (encryptedAmount.length > 50) {
      // Too long to be a plain number, likely encrypted data
      return null;
    }
    const parsed = parseFloat(encryptedAmount);
    if (isNaN(parsed) || !isFinite(parsed)) {
      return null;
    }
    // Validate that the amount is within reasonable bounds
    const MAX_REASONABLE_AMOUNT = 1_000_000_000_000; // 1 trillion
    if (Math.abs(parsed) > MAX_REASONABLE_AMOUNT) {
      logger.warn('Parsed amount (decrypt error) is unreasonably large, likely corrupted:', parsed);
      return null;
    }
    return parsed;
  }
}

/**
 * Check if Node.js crypto is available (server-side only)
 */
function isNodeCryptoAvailable(): boolean {
  try {
    // Try to access Node.js crypto module
    if (typeof require !== 'undefined') {
      const crypto = require('crypto');
      return !!crypto && typeof crypto.createDecipheriv === 'function';
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Decrypt a transaction description when reading from database
 * If decryption fails, assumes it's plain text (backward compatibility with old data)
 * In browser environment, returns text as-is (server should handle decryption)
 */
export function decryptDescription(encryptedDescription: string | null): string | null {
  if (!encryptedDescription) return null;
  
  // Check if we're in a browser environment
  const isBrowser = typeof window !== 'undefined';
  
  // If in browser and Node.js crypto is not available, return as-is
  // The server API should handle decryption when fetching transactions
  if (isBrowser && !isNodeCryptoAvailable()) {
    // Check if the text looks like encrypted data
    // Encrypted data format: salt (128 hex chars) + iv (32 hex chars) + tag (32 hex chars) + encrypted data
    // Minimum length: (64 + 16 + 16) * 2 = 192 hex characters
    const MIN_ENCRYPTED_LENGTH = 192;
    const isHexString = /^[0-9a-f]+$/i.test(encryptedDescription);
    
    // If it looks encrypted but we can't decrypt in browser, return as-is
    // The server API should handle decryption
    if (encryptedDescription.length >= MIN_ENCRYPTED_LENGTH && isHexString) {
      // This is encrypted data but we can't decrypt in browser
      // Return as-is - it should be decrypted by the server API
      return encryptedDescription;
    }
    
    // Otherwise, assume it's plain text
    return encryptedDescription;
  }
  
  // Check if the text looks like encrypted data
  // Encrypted data format: salt (128 hex chars) + iv (32 hex chars) + tag (32 hex chars) + encrypted data
  // Minimum length: (64 + 16 + 16) * 2 = 192 hex characters
  const MIN_ENCRYPTED_LENGTH = 192;
  const isHexString = /^[0-9a-f]+$/i.test(encryptedDescription);
  
  // If it's too short or doesn't look like hex, it's probably plain text
  if (encryptedDescription.length < MIN_ENCRYPTED_LENGTH || !isHexString) {
    return encryptedDescription;
  }
  
  // Try to decrypt - if it fails, assume it's plain text (backward compatibility)
  // This can happen if:
  // 1. Data was encrypted with a different key (e.g., after key rotation)
  // 2. Data is corrupted
  // 3. Data was never encrypted (old plain text data)
  try {
    return decrypt(encryptedDescription, true); // silent mode to reduce log noise
  } catch (error) {
    // If decryption fails, assume it's plain text (old data)
    // This allows backward compatibility with existing unencrypted descriptions
    // Only log once per unique description to avoid spam
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('unable to authenticate')) {
      // This is expected when data was encrypted with a different key
      // Don't log every occurrence to avoid log spam
      return encryptedDescription;
    }
    if (errorMessage.includes('ENCRYPTION_KEY')) {
      // Missing encryption key - return as-is (will be handled by server)
      return encryptedDescription;
    }
    // For other errors, log a warning only if not in browser (to avoid console spam)
    if (!isBrowser) {
    logger.warn('Failed to decrypt description, treating as plain text:', errorMessage);
    }
    return encryptedDescription;
  }
}

