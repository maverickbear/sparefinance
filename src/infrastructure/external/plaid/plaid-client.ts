/**
 * Plaid Client
 * Infrastructure layer for Plaid API client initialization
 */

import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

let plaidClient: PlaidApi | null = null;

/**
 * Get or create Plaid client instance
 */
export function getPlaidClient(): PlaidApi {
  if (plaidClient) {
    return plaidClient;
  }

  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const plaidEnv = process.env.PLAID_ENV || 'sandbox';

  if (!clientId || !secret) {
    throw new Error('Plaid credentials are not configured. Please set PLAID_CLIENT_ID and PLAID_SECRET environment variables.');
  }

  const configuration = new Configuration({
    basePath: PlaidEnvironments[plaidEnv as keyof typeof PlaidEnvironments] || PlaidEnvironments.sandbox,
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': clientId,
        'PLAID-SECRET': secret,
      },
    },
  });

  plaidClient = new PlaidApi(configuration);
  return plaidClient;
}

/**
 * Get Plaid environment
 */
export function getPlaidEnv(): string {
  return process.env.PLAID_ENV || 'sandbox';
}

