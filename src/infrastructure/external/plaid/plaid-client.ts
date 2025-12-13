/**
 * Plaid Client
 * Infrastructure layer for Plaid API client initialization
 * Handles all Plaid API calls with proper error handling and retry logic
 */

import { Configuration, PlaidApi, PlaidEnvironments, CountryCode, Products } from 'plaid';
import { logger } from '@/lib/utils/logger';
import {
  PlaidAccount,
  PlaidTransaction,
  PlaidHolding,
  LinkTokenRequest,
  LinkTokenResponse,
  ExchangePublicTokenRequest,
  ExchangePublicTokenResponse,
} from '@/src/domain/plaid/plaid.types';

let plaidClient: PlaidApi | null = null;

/**
 * Get or create Plaid client instance
 */
function getPlaidClient(): PlaidApi {
  if (plaidClient) {
    return plaidClient;
  }

  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const env = (process.env.PLAID_ENV as 'sandbox' | 'development' | 'production') || 'sandbox';

  if (!clientId || !secret) {
    throw new Error('PLAID_CLIENT_ID and PLAID_SECRET must be set');
  }

  // Map environment string to PlaidEnvironments
  let basePath: string;
  switch (env) {
    case 'sandbox':
      basePath = PlaidEnvironments.sandbox;
      break;
    case 'development':
      basePath = PlaidEnvironments.development;
      break;
    case 'production':
      basePath = PlaidEnvironments.production;
      break;
    default:
      basePath = PlaidEnvironments.sandbox;
  }

  const configuration = new Configuration({
    basePath,
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': clientId,
        'PLAID-SECRET': secret,
      },
    },
  });

  plaidClient = new PlaidApi(configuration);

  logger.info('[PlaidClient] Initialized Plaid client', { env });

  return plaidClient;
}

/**
 * Retry helper with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry on certain errors
      if (error?.response?.status === 400 || error?.response?.status === 401) {
        throw error;
      }

      // If this is the last attempt, throw
      if (attempt === maxRetries) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      logger.warn('[PlaidClient] Retry attempt', { attempt: attempt + 1, maxRetries, delay });
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Unknown error in retry');
}

/**
 * Create a link token for Plaid Link
 */
export async function createLinkToken(request: LinkTokenRequest): Promise<LinkTokenResponse> {
  const client = getPlaidClient();

  try {
    const response = await retryWithBackoff(async () => {
      return await client.linkTokenCreate({
        user: {
          client_user_id: request.userId,
        },
        client_name: request.clientName || 'Spare Finance',
        products: (request.products as Products[]) || [Products.Transactions, Products.Auth],
        country_codes: (request.countryCodes as CountryCode[]) || [CountryCode.Us, CountryCode.Ca],
        language: request.language || 'en',
        transactions: {
          days_requested: 730, // Maximum allowed by Plaid (default is 90)
        },
      });
    });

    if (!response.data.link_token) {
      throw new Error('Failed to create link token: no link_token in response');
    }

    return {
      linkToken: response.data.link_token,
      expiration: response.data.expiration || new Date(),
    };
  } catch (error: any) {
    // NEVER log access tokens or sensitive data
    logger.error('[PlaidClient] Error creating link token', {
      error: error?.message || 'Unknown error',
      errorType: error?.response?.data?.error_type,
      errorCode: error?.response?.data?.error_code,
    });
    throw error;
  }
}

/**
 * Exchange public token for access token
 */
export async function exchangePublicToken(
  request: ExchangePublicTokenRequest
): Promise<ExchangePublicTokenResponse> {
  const client = getPlaidClient();

  try {
    const response = await retryWithBackoff(async () => {
      return await client.itemPublicTokenExchange({
        public_token: request.publicToken,
      });
    });

    if (!response.data.access_token || !response.data.item_id) {
      throw new Error('Failed to exchange public token: missing access_token or item_id');
    }

    // Get institution info
    const itemResponse = await retryWithBackoff(async () => {
      return await client.itemGet({
        access_token: response.data.access_token,
      });
    });

    const institutionId = itemResponse.data.item.institution_id || null;
    let institutionName: string | null = null;

    if (institutionId) {
      try {
        const institutionResponse = await retryWithBackoff(async () => {
          return await client.institutionsGetById({
            institution_id: institutionId,
            country_codes: [CountryCode.Us, CountryCode.Ca],
          });
        });
        institutionName = institutionResponse.data.institution.name || null;
      } catch (error: any) {
        // Log but don't fail if we can't get institution name
        logger.warn('[PlaidClient] Could not fetch institution name', {
          institutionId,
          error: error?.message,
        });
      }
    }

    return {
      itemId: response.data.item_id,
      accessToken: response.data.access_token, // Will be encrypted before storage
      institutionId: institutionId || '',
      institutionName: institutionName || '',
    };
  } catch (error: any) {
    // NEVER log access tokens or sensitive data
    logger.error('[PlaidClient] Error exchanging public token', {
      error: error?.message || 'Unknown error',
      errorType: error?.response?.data?.error_type,
      errorCode: error?.response?.data?.error_code,
    });
    throw error;
  }
}

/**
 * Get accounts for an item
 * Fase A: Only list accounts, no transactions
 */
export async function getAccounts(accessToken: string): Promise<PlaidAccount[]> {
  const client = getPlaidClient();

  try {
    const response = await retryWithBackoff(async () => {
      return await client.accountsGet({
        access_token: accessToken,
      });
    });

    return response.data.accounts.map(account => ({
      accountId: account.account_id,
      itemId: response.data.item.item_id,
      name: account.name,
      officialName: account.official_name || null,
      type: account.type as PlaidAccount['type'],
      subtype: account.subtype || null,
      mask: account.mask || null,
      balances: {
        available: account.balances.available,
        current: account.balances.current,
        limit: account.balances.limit || null,
        isoCurrencyCode: account.balances.iso_currency_code || null,
        unofficialCurrencyCode: account.balances.unofficial_currency_code || null,
      },
      verificationStatus: account.verification_status || null,
      verificationName: null, // Not available in accountsGet
      persistentAccountId: account.persistent_account_id || null,
      holderCategory: (account.holder_category as PlaidAccount['holderCategory']) || null,
    }));
  } catch (error: any) {
    // NEVER log access tokens
    logger.error('[PlaidClient] Error getting accounts', {
      error: error?.message || 'Unknown error',
      errorType: error?.response?.data?.error_type,
      errorCode: error?.response?.data?.error_code,
    });
    throw error;
  }
}

/**
 * Sync transactions for an item using /transactions/sync
 * Implements Plaid's recommended Transactions Sync API with cursor-based pagination
 * Returns added, modified, and removed transactions
 */
export async function syncTransactions(
  accessToken: string,
  cursor?: string | null,
  accountIds?: string[]
): Promise<{
  added: PlaidTransaction[];
  modified: PlaidTransaction[];
  removed: string[]; // transaction_ids
  hasMore: boolean;
  nextCursor: string | null;
}> {
  const client = getPlaidClient();

  try {
    const response = await retryWithBackoff(async () => {
      return await client.transactionsSync({
        access_token: accessToken,
        cursor: cursor || undefined,
        options: accountIds && accountIds.length > 0 ? {
          account_ids: accountIds,
        } as any : undefined,
      });
    });

    // Map added transactions
    const added: PlaidTransaction[] = (response.data.added || []).map(tx => ({
      transactionId: tx.transaction_id,
      accountId: tx.account_id,
      amount: tx.amount,
      date: tx.date,
      authorizedDate: tx.authorized_date || null,
      name: tx.name,
      merchantName: tx.merchant_name || null,
      category: tx.category || null,
      categoryId: tx.category_id || null,
      primaryCategory: tx.personal_finance_category?.primary || null,
      detailedCategory: tx.personal_finance_category?.detailed || null,
      isoCurrencyCode: tx.iso_currency_code || null,
      unofficialCurrencyCode: tx.unofficial_currency_code || null,
      paymentChannel: tx.payment_channel,
      pending: tx.pending,
      accountOwner: tx.account_owner || null,
    }));

    // Map modified transactions
    const modified: PlaidTransaction[] = (response.data.modified || []).map(tx => ({
      transactionId: tx.transaction_id,
      accountId: tx.account_id,
      amount: tx.amount,
      date: tx.date,
      authorizedDate: tx.authorized_date || null,
      name: tx.name,
      merchantName: tx.merchant_name || null,
      category: tx.category || null,
      categoryId: tx.category_id || null,
      primaryCategory: tx.personal_finance_category?.primary || null,
      detailedCategory: tx.personal_finance_category?.detailed || null,
      isoCurrencyCode: tx.iso_currency_code || null,
      unofficialCurrencyCode: tx.unofficial_currency_code || null,
      paymentChannel: tx.payment_channel,
      pending: tx.pending,
      accountOwner: tx.account_owner || null,
    }));

    // Extract removed transaction IDs
    const removed: string[] = response.data.removed?.map(r => r.transaction_id) || [];

    return {
      added,
      modified,
      removed,
      hasMore: response.data.has_more || false,
      nextCursor: response.data.next_cursor || null,
    };
  } catch (error: any) {
    // NEVER log access tokens
    logger.error('[PlaidClient] Error syncing transactions', {
      error: error?.message || 'Unknown error',
      errorType: error?.response?.data?.error_type,
      errorCode: error?.response?.data?.error_code,
      hasCursor: !!cursor,
    });
    throw error;
  }
}

/**
 * Get holdings for investment accounts
 * Fase D: Returns all holdings for investment accounts associated with the access token
 */
export async function getHoldings(accessToken: string): Promise<{
  holdings: PlaidHolding[];
  securities: Map<string, { tickerSymbol: string | null; name: string | null }>;
}> {
  const client = getPlaidClient();

  try {
    const response = await retryWithBackoff(async () => {
      return await client.investmentsHoldingsGet({
        access_token: accessToken,
      });
    });

    // Map Plaid holdings to domain types
    const holdings: PlaidHolding[] = response.data.holdings.map(holding => ({
      accountId: holding.account_id,
      securityId: holding.security_id || null,
      institutionSecurityId: (holding as any).institution_security_id || null,
      institutionPrice: holding.institution_price || null,
      quantity: holding.quantity,
      isoCurrencyCode: holding.iso_currency_code || null,
      unofficialCurrencyCode: holding.unofficial_currency_code || null,
      costBasis: holding.cost_basis || null,
    }));

    // Map securities for symbol lookup
    const securities = new Map<string, { tickerSymbol: string | null; name: string | null }>();
    if (response.data.securities) {
      for (const security of response.data.securities) {
        if (security.security_id) {
          securities.set(security.security_id, {
            tickerSymbol: security.ticker_symbol || null,
            name: security.name || null,
          });
        }
      }
    }

    return { holdings, securities };
  } catch (error: any) {
    // NEVER log access tokens
    logger.error('[PlaidClient] Error getting holdings', {
      error: error?.message || 'Unknown error',
      errorType: error?.response?.data?.error_type,
      errorCode: error?.response?.data?.error_code,
    });
    throw error;
  }
}

/**
 * Get balance for an account
 */
export async function getBalance(accessToken: string, accountId: string): Promise<number> {
  const client = getPlaidClient();

  try {
    const response = await retryWithBackoff(async () => {
      return await client.accountsBalanceGet({
        access_token: accessToken,
        options: {
          account_ids: [accountId],
        },
      });
    });

    const account = response.data.accounts.find(acc => acc.account_id === accountId);
    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }

    return account.balances.current || 0;
  } catch (error: any) {
    // NEVER log access tokens
    logger.error('[PlaidClient] Error getting balance', {
      accountId,
      error: error?.message || 'Unknown error',
      errorType: error?.response?.data?.error_type,
      errorCode: error?.response?.data?.error_code,
    });
    throw error;
  }
}

/**
 * Get webhook verification key from Plaid
 * Used to verify webhook signatures
 */
export async function getWebhookVerificationKey(keyId: string): Promise<string> {
  const client = getPlaidClient();

  try {
    const response = await retryWithBackoff(async () => {
      return await client.webhookVerificationKeyGet({
        key_id: keyId,
      });
    });

    if (!response.data.key) {
      throw new Error('Failed to get webhook verification key: no key in response');
    }

    // Convert JWKPublicKey to PEM format string
    const key = response.data.key;
    if (typeof key === 'string') {
      return key;
    }
    // If it's a JWK object, convert it to PEM format
    // For now, we'll use JSON.stringify as a fallback, but ideally should convert to PEM
    return JSON.stringify(key);
  } catch (error: any) {
    logger.error('[PlaidClient] Error getting webhook verification key', {
      keyId,
      error: error?.message || 'Unknown error',
      errorType: error?.response?.data?.error_type,
      errorCode: error?.response?.data?.error_code,
    });
    throw error;
  }
}
