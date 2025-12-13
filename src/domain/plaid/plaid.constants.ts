/**
 * Domain constants for Plaid integration
 * Controlled values for status, error codes, etc.
 * These values are used to validate and map Plaid responses
 */

/**
 * Valid Plaid item status values
 * Status is never free-form - always mapped from Plaid responses via plaid.mapper.ts
 */
export const PLAID_ITEM_STATUS = [
  'good',
  'item_login_required',
  'error',
  'pending_expiration',
  'pending_metadata_update',
] as const;

/**
 * Known Plaid error codes
 * These are mapped from Plaid API responses to controlled values
 */
export const PLAID_ERROR_CODES = [
  // Item errors
  'ITEM_LOGIN_REQUIRED',
  'ITEM_NOT_SUPPORTED',
  'ITEM_NO_ERROR',
  'ITEM_NOT_FOUND',
  'ITEM_NOT_ACCESSIBLE',
  
  // Institution errors
  'INSTITUTION_DOWN',
  'INSTITUTION_NOT_RESPONDING',
  'INSTITUTION_NOT_AVAILABLE',
  
  // Rate limit errors
  'RATE_LIMIT_EXCEEDED',
  
  // API errors
  'API_ERROR',
  'INVALID_ACCESS_TOKEN',
  'INVALID_CREDENTIALS',
  'INVALID_INPUT',
  'INVALID_REQUEST',
  
  // Auth errors
  'AUTH_ERROR',
  'INSUFFICIENT_CREDENTIALS',
  
  // Product errors
  'PRODUCT_NOT_READY',
  'PRODUCT_NOT_ENABLED',
  
  // Other
  'UNKNOWN_ERROR',
] as const;

/**
 * Plaid account types
 */
export const PLAID_ACCOUNT_TYPES = [
  'depository',
  'credit',
  'loan',
  'investment',
  'other',
] as const;

/**
 * Plaid account subtypes (common ones)
 */
export const PLAID_ACCOUNT_SUBTYPES = [
  'checking',
  'savings',
  'cd',
  'money market',
  'paypal',
  'prepaid',
  'credit card',
  'mortgage',
  'auto',
  'student',
  'personal',
  '401k',
  '403b',
  'ira',
  'brokerage',
  '529',
] as const;

/**
 * Plaid webhook types
 */
export const PLAID_WEBHOOK_TYPES = [
  'TRANSACTIONS',
  'ITEM',
  'HOLDINGS',
  'INVESTMENTS_TRANSACTIONS',
  'LIABILITIES',
  'AUTH',
] as const;

/**
 * Plaid webhook codes for TRANSACTIONS
 */
export const PLAID_TRANSACTIONS_WEBHOOK_CODES = [
  'INITIAL_UPDATE',
  'HISTORICAL_UPDATE',
  'DEFAULT_UPDATE',
  'TRANSACTIONS_REMOVED',
] as const;

/**
 * Plaid webhook codes for ITEM
 */
export const PLAID_ITEM_WEBHOOK_CODES = [
  'ERROR',
  'PENDING_EXPIRATION',
  'USER_PERMISSION_REVOKED',
  'WEBHOOK_UPDATE_ACKNOWLEDGED',
] as const;

/**
 * Plaid products
 */
export const PLAID_PRODUCTS = [
  'transactions',
  'auth',
  'identity',
  'income',
  'assets',
  'investments',
  'liabilities',
] as const;

/**
 * Note: Textos exibidos ao usuário ficam no app (i18n), não no banco.
 * O banco guarda apenas códigos/enum.
 * Status nunca é free-form vindo direto do Plaid - sempre mapeado pelo plaid.mapper.ts
 */
