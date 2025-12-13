/**
 * Domain types for Plaid integration
 * Pure TypeScript types with no external dependencies
 */

/**
 * Plaid Item - represents a bank connection
 */
export interface PlaidItem {
  id: string;
  userId: string;
  itemId: string; // Plaid's item_id
  accessTokenEncrypted: string; // Encrypted access token
  institutionId: string | null;
  institutionName: string | null;
  status: PlaidItemStatus;
  errorCode: string | null;
  errorMessage: string | null;
  consentExpiresAt: Date | string | null;
  lastSuccessfulUpdate: Date | string | null;
  isSyncing: boolean;
  syncStartedAt: Date | string | null;
  transactionsCursor: string | null; // Cursor for /transactions/sync pagination
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Plaid Account - represents a single account from Plaid
 */
export interface PlaidAccount {
  accountId: string; // Plaid's account_id
  itemId: string; // Plaid's item_id
  name: string;
  officialName: string | null;
  type: PlaidAccountType;
  subtype: string | null;
  mask: string | null;
  balances: {
    available: number | null;
    current: number | null;
    limit: number | null;
    isoCurrencyCode: string | null;
    unofficialCurrencyCode: string | null;
  };
  verificationStatus: string | null;
  verificationName: string | null;
  persistentAccountId: string | null;
  holderCategory: 'personal' | 'business' | 'unrecognized' | null;
}

/**
 * Plaid Transaction - represents a transaction from Plaid
 */
export interface PlaidTransaction {
  transactionId: string; // Plaid's transaction_id
  accountId: string; // Plaid's account_id
  amount: number;
  date: Date | string;
  authorizedDate: Date | string | null;
  name: string;
  merchantName: string | null;
  category: string[] | null;
  categoryId: string | null;
  primaryCategory: string | null;
  detailedCategory: string | null;
  isoCurrencyCode: string | null;
  unofficialCurrencyCode: string | null;
  paymentChannel: string;
  pending: boolean;
  accountOwner: string | null;
}

/**
 * Plaid Holding - represents an investment holding
 */
export interface PlaidHolding {
  accountId: string;
  securityId: string | null;
  institutionSecurityId: string | null;
  institutionPrice: number | null;
  quantity: number;
  isoCurrencyCode: string | null;
  unofficialCurrencyCode: string | null;
  costBasis: number | null;
}

/**
 * Plaid Webhook Event
 */
export interface PlaidWebhookEvent {
  webhookType: string;
  webhookCode: string;
  itemId: string;
  environment: string;
  newTransactions?: number;
  removedTransactions?: string[];
  accountIds?: string[];
  error?: {
    errorType: string;
    errorCode: string;
    errorMessage: string;
  };
}

/**
 * Plaid Error
 */
export interface PlaidError {
  errorType: string;
  errorCode: string;
  errorMessage: string;
  displayMessage: string | null;
  requestId: string | null;
}

/**
 * Link Token Request
 */
export interface LinkTokenRequest {
  userId: string;
  clientName?: string;
  language?: string;
  countryCodes?: string[];
  products?: string[];
}

/**
 * Link Token Response
 */
export interface LinkTokenResponse {
  linkToken: string;
  expiration: Date | string;
}

/**
 * Exchange Public Token Request
 */
export interface ExchangePublicTokenRequest {
  publicToken: string;
  userId: string;
}

/**
 * Exchange Public Token Response
 */
export interface ExchangePublicTokenResponse {
  itemId: string;
  accessToken: string; // Will be encrypted before storage
  institutionId: string;
  institutionName: string;
}

// Type definitions for constants
export type PlaidItemStatus = 
  | 'good'
  | 'item_login_required'
  | 'error'
  | 'pending_expiration'
  | 'pending_metadata_update';

export type PlaidAccountType = 
  | 'depository' // checking, savings
  | 'credit' // credit card
  | 'loan' // mortgage, auto loan
  | 'investment' // investment account
  | 'other';
