/**
 * Encryption utilities for sensitive data like API tokens
 * Uses AES-256-GCM encryption with a key derived from environment variable
 * NOTE: This module requires Node.js crypto and should only be used server-side
 */

import { logger } from "./logger";

// Import crypto conditionally - will be undefined in browser
let crypto: typeof import('crypto') | undefined;
try {
  if (typeof window === 'undefined') {
    // Only import in Node.js environment
    crypto = require('crypto');
  }
} catch {
  // crypto not available (browser environment)
  crypto = undefined;
}

const ENCRYPTION_KEY_ENV = process.env.ENCRYPTION_KEY;
const NEXT_PUBLIC_ENCRYPTION_KEY_ENV = process.env.NEXT_PUBLIC_ENCRYPTION_KEY;

const log = logger.withPrefix("Encryption");

// Only log in development
if (process.env.NODE_ENV === "development") {
  log.debug("Environment check:", {
    hasENCRYPTION_KEY: !!ENCRYPTION_KEY_ENV,
    hasNEXT_PUBLIC_ENCRYPTION_KEY: !!NEXT_PUBLIC_ENCRYPTION_KEY_ENV,
  });
}

const ENCRYPTION_KEY = ENCRYPTION_KEY_ENV || NEXT_PUBLIC_ENCRYPTION_KEY_ENV || '';

// Only warn when encryption is actually needed, not on module load
// The warning will be shown in getKey() when encryption/decryption is attempted

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For AES, this is always 16
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

/**
 * Check if Node.js crypto is available
 */
function isCryptoAvailable(): boolean {
  try {
    return !!crypto && typeof crypto.scryptSync === 'function';
  } catch {
    return false;
  }
}

/**
 * Derive encryption key from environment variable
 */
function getKey(silent: boolean = false): Buffer {
  // Check if we're in browser - crypto from Node.js is not available
  if (typeof window !== 'undefined' || !isCryptoAvailable()) {
    if (!silent) {
      logger.warn('[Encryption] ⚠️  Node.js crypto not available (browser environment)');
    }
    throw new Error(
      'ENCRYPTION_KEY is not available in browser environment. ' +
      'Decryption should be handled on the server side.'
    );
  }
  
  if (!ENCRYPTION_KEY) {
    // Only warn in development, error in production
    if (process.env.NODE_ENV === 'development') {
      logger.warn('[Encryption] ⚠️  No encryption key found in environment variables. Encryption/decryption will fail.');
    } else {
      logger.error('[Encryption] ❌ ENCRYPTION_KEY is missing!');
    }
    throw new Error(
      'ENCRYPTION_KEY environment variable is not set. ' +
      'Please add it to your .env.local file and restart your development server. ' +
      'Generate a key with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  // Use a simple key derivation (in production, consider using PBKDF2)
  if (!crypto) {
    throw new Error("Crypto is not available in this environment");
  }
  return crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
}

/**
 * Encrypt sensitive data (e.g., API tokens)
 */
export function encrypt(text: string): string {
  if (!text) {
    return text;
  }

  if (!crypto) {
    throw new Error("Crypto is not available in this environment");
  }

  try {
    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(SALT_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    // Combine salt + iv + tag + encrypted
    return salt.toString('hex') + iv.toString('hex') + tag.toString('hex') + encrypted;
  } catch (error) {
    logger.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt sensitive data (e.g., API tokens)
 * @param silent - If true, suppresses detailed logs (useful for backward compatibility attempts)
 */
export function decrypt(encryptedText: string, silent: boolean = false): string {
  if (!encryptedText) {
    return encryptedText;
  }
  
  if (!crypto) {
    throw new Error("Crypto is not available in this environment");
  }
  
  try {
    const key = getKey(silent);
    
    // Extract salt, iv, tag, and encrypted data
    const salt = Buffer.from(encryptedText.slice(0, SALT_LENGTH * 2), 'hex');
    const iv = Buffer.from(encryptedText.slice(SALT_LENGTH * 2, TAG_POSITION * 2), 'hex');
    const tag = Buffer.from(encryptedText.slice(TAG_POSITION * 2, ENCRYPTED_POSITION * 2), 'hex');
    const encrypted = encryptedText.slice(ENCRYPTED_POSITION * 2);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    if (!silent) {
      logger.error('[Encryption] Decryption error:', error);
    }
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Check if encryption is properly configured
 */
export function isEncryptionConfigured(): boolean {
  return !!ENCRYPTION_KEY;
}

