/**
 * Questrade API Client
 * Handles OAuth authentication and API requests
 */

import { encrypt, decrypt } from '@/lib/utils/encryption';
import type {
  QuestradeTokenResponse,
  QuestradeAccountsResponse,
  QuestradePositionsResponse,
  QuestradeBalancesResponse,
  QuestradeActivitiesResponse,
  QuestradeQuotesResponse,
  QuestradeSymbolsResponse,
  QuestradeSymbolDetailResponse,
  QuestradeOrdersResponse,
  QuestradeExecutionsResponse,
  QuestradeCandlesResponse,
  QuestradeErrorResponse,
} from './types';

const QUESTRADE_TOKEN_URL = 'https://login.questrade.com/oauth2/token';

/**
 * Exchange manual authorization token for access and refresh tokens
 * The manual authorization token is used as the refresh_token in the first call
 */
export async function exchangeAuthToken(
  manualAuthToken: string
): Promise<QuestradeTokenResponse> {
  try {
    // Questrade API documentation shows GET request with query string
    // https://www.questrade.com/api/documentation/getting-started
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: manualAuthToken,
    });

    const url = `${QUESTRADE_TOKEN_URL}?${params.toString()}`;
    
    console.log(`[Questrade API] Exchanging auth token...`);
    console.log(`[Questrade API] Token URL: ${QUESTRADE_TOKEN_URL}`);
    console.log(`[Questrade API] Token length: ${manualAuthToken.length}`);
    console.log(`[Questrade API] Using GET request with query string`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    console.log(`[Questrade API] Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      let errorDetails: any = null;
      
      try {
        const text = await response.text();
        console.error(`[Questrade API] Token exchange error response (raw):`, text);
        
        try {
          errorDetails = JSON.parse(text);
          errorMessage = errorDetails.message || errorDetails.error || errorMessage;
          console.error(`[Questrade API] Token exchange error (parsed):`, errorDetails);
        } catch (parseError) {
          errorMessage = text || errorMessage;
          console.error(`[Questrade API] Token exchange error (text only):`, text);
        }
      } catch (textError) {
        console.error(`[Questrade API] Failed to read error response:`, textError);
      }
      
      throw new Error(errorMessage);
    }

    const data: QuestradeTokenResponse = await response.json();
    console.log(`[Questrade API] Token exchange successful, API server: ${data.api_server}`);
    return data;
  } catch (error: any) {
    console.error('Error exchanging Questrade auth token:', error);
    throw new Error(
      error.message || 'Failed to exchange Questrade authorization token'
    );
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<QuestradeTokenResponse> {
  try {
    // Questrade API documentation shows GET request with query string
    // https://www.questrade.com/api/documentation/getting-started
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const url = `${QUESTRADE_TOKEN_URL}?${params.toString()}`;
    
    console.log(`[Questrade API] Refreshing access token...`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const error: QuestradeErrorResponse = await response.json();
        errorMessage = error.message || errorMessage;
        console.error(`[Questrade API] Token refresh error:`, error);
      } catch (parseError) {
        try {
          const text = await response.text();
          console.error(`[Questrade API] Token refresh error (text):`, text);
          errorMessage = text || errorMessage;
        } catch (textError) {
          // Ignore
        }
      }
      throw new Error(errorMessage);
    }

    const data: QuestradeTokenResponse = await response.json();
    console.log(`[Questrade API] Token refresh successful, API server: ${data.api_server}`);
    return data;
  } catch (error: any) {
    console.error('Error refreshing Questrade access token:', error);
    throw new Error(error.message || 'Failed to refresh Questrade access token');
  }
}

/**
 * Make authenticated request to Questrade API
 */
export async function questradeRequest<T>(
  apiServerUrl: string,
  accessToken: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  try {
    // Normalize API server URL (remove trailing slash if present)
    const normalizedApiUrl = apiServerUrl.replace(/\/$/, '');
    // Ensure endpoint starts with /
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${normalizedApiUrl}${normalizedEndpoint}`;
    
    console.log(`[Questrade API] Making request to: ${url}`);
    
    // Build headers - Questrade requires Accept: application/json header
    // According to documentation: Error 1013 = "Requesting anything other than 'application/json'"
    // Questrade is very strict about the Accept header - it must be exactly 'application/json'
    // We need to ensure no other headers interfere and that Accept is set correctly
    
    // Remove headers from options to avoid conflicts
    const { headers: optionsHeaders, ...fetchOptions } = options;
    
    // Build a clean headers object with only what we need
    // Use a plain object to avoid any normalization issues
    const cleanHeaders: Record<string, string> = {
      'Accept': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    };
    
    // Only add Content-Type for POST/PUT/PATCH requests
    if (options.method && ['POST', 'PUT', 'PATCH'].includes(options.method)) {
      cleanHeaders['Content-Type'] = 'application/json';
    }

    // Don't merge with options.headers - we want complete control over headers
    // This ensures no other headers interfere with the Accept header
    
    // Log headers for debugging (don't log Authorization value)
    const headersForLog = { ...cleanHeaders };
    headersForLog['Authorization'] = 'Bearer ***';
    console.log(`[Questrade API] Request headers:`, headersForLog);
    console.log(`[Questrade API] Accept header value:`, cleanHeaders['Accept']);
    console.log(`[Questrade API] URL:`, url);
    
    const response = await fetch(url, {
      ...fetchOptions,
      method: options.method || 'GET',
      headers: cleanHeaders,
    });

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const error: QuestradeErrorResponse = await response.json();
        errorMessage = error.message || errorMessage;
        console.error(`[Questrade API] Error response:`, error);
      } catch (parseError) {
        // If response is not JSON, try to get text
        try {
          const text = await response.text();
          console.error(`[Questrade API] Error response (text):`, text);
          errorMessage = text || errorMessage;
        } catch (textError) {
          // Ignore
        }
      }
      throw new Error(errorMessage);
    }

    const data: T = await response.json();
    return data;
  } catch (error: any) {
    console.error(`[Questrade API] Error making request to ${endpoint}:`, error);
    throw new Error(
      error.message || `Failed to make Questrade API request to ${endpoint}`
    );
  }
}

/**
 * Get all accounts for the authenticated user
 */
export async function getQuestradeAccounts(
  apiServerUrl: string,
  accessToken: string
): Promise<QuestradeAccountsResponse> {
  return questradeRequest<QuestradeAccountsResponse>(
    apiServerUrl,
    accessToken,
    '/v1/accounts'
  );
}

/**
 * Get account details
 */
export async function getQuestradeAccount(
  apiServerUrl: string,
  accessToken: string,
  accountId: string
): Promise<QuestradeAccount> {
  const response = await questradeRequest<QuestradeAccountsResponse>(
    apiServerUrl,
    accessToken,
    '/v1/accounts'
  );
  const account = response.accounts.find((acc) => acc.number === accountId);
  if (!account) {
    throw new Error(`Account ${accountId} not found`);
  }
  return account;
}

/**
 * Get positions for an account
 */
export async function getQuestradePositions(
  apiServerUrl: string,
  accessToken: string,
  accountId: string
): Promise<QuestradePositionsResponse> {
  return questradeRequest<QuestradePositionsResponse>(
    apiServerUrl,
    accessToken,
    `/v1/accounts/${accountId}/positions`
  );
}

/**
 * Get balances for an account
 */
export async function getQuestradeBalances(
  apiServerUrl: string,
  accessToken: string,
  accountId: string
): Promise<QuestradeBalancesResponse> {
  return questradeRequest<QuestradeBalancesResponse>(
    apiServerUrl,
    accessToken,
    `/v1/accounts/${accountId}/balances`
  );
}

/**
 * Get activities (transactions) for an account
 */
export async function getQuestradeActivities(
  apiServerUrl: string,
  accessToken: string,
  accountId: string,
  startTime: string,
  endTime?: string
): Promise<QuestradeActivitiesResponse> {
  // startTime is required by Questrade API
  if (!startTime) {
    throw new Error('startTime is required for Questrade activities API');
  }

  let endpoint = `/v1/accounts/${accountId}/activities`;
  const params = new URLSearchParams();
  params.append('startTime', startTime);
  if (endTime) params.append('endTime', endTime);
  endpoint += `?${params.toString()}`;

  return questradeRequest<QuestradeActivitiesResponse>(
    apiServerUrl,
    accessToken,
    endpoint
  );
}

/**
 * Get quotes for symbols
 */
export async function getQuestradeQuotes(
  apiServerUrl: string,
  accessToken: string,
  symbolIds: number[]
): Promise<QuestradeQuotesResponse> {
  const ids = symbolIds.join(',');
  return questradeRequest<QuestradeQuotesResponse>(
    apiServerUrl,
    accessToken,
    `/v1/markets/quotes/${ids}`
  );
}

/**
 * Search for symbols
 */
export async function searchQuestradeSymbols(
  apiServerUrl: string,
  accessToken: string,
  prefix: string
): Promise<QuestradeSymbolsResponse> {
  return questradeRequest<QuestradeSymbolsResponse>(
    apiServerUrl,
    accessToken,
    `/v1/symbols/search?prefix=${encodeURIComponent(prefix)}`
  );
}

/**
 * Get symbol details
 */
export async function getQuestradeSymbolDetails(
  apiServerUrl: string,
  accessToken: string,
  symbolIds: number[]
): Promise<QuestradeSymbolDetailResponse> {
  const ids = symbolIds.join(',');
  return questradeRequest<QuestradeSymbolDetailResponse>(
    apiServerUrl,
    accessToken,
    `/v1/symbols/${ids}`
  );
}

/**
 * Get orders for an account
 */
export async function getQuestradeOrders(
  apiServerUrl: string,
  accessToken: string,
  accountId: string,
  stateFilter?: string,
  startDate?: string,
  endDate?: string
): Promise<QuestradeOrdersResponse> {
  let endpoint = `/v1/accounts/${accountId}/orders`;
  const params = new URLSearchParams();
  if (stateFilter) params.append('stateFilter', stateFilter);
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  const queryString = params.toString();
  if (queryString) endpoint += `?${queryString}`;
  
  return questradeRequest<QuestradeOrdersResponse>(
    apiServerUrl,
    accessToken,
    endpoint
  );
}

/**
 * Get executions for an account
 */
export async function getQuestradeExecutions(
  apiServerUrl: string,
  accessToken: string,
  accountId: string,
  startTime?: string,
  endTime?: string
): Promise<QuestradeExecutionsResponse> {
  let endpoint = `/v1/accounts/${accountId}/executions`;
  const params = new URLSearchParams();
  if (startTime) params.append('startTime', startTime);
  if (endTime) params.append('endTime', endTime);
  const queryString = params.toString();
  if (queryString) endpoint += `?${queryString}`;
  
  return questradeRequest<QuestradeExecutionsResponse>(
    apiServerUrl,
    accessToken,
    endpoint
  );
}

/**
 * Get candles (historical price data) for a symbol
 */
export async function getQuestradeCandles(
  apiServerUrl: string,
  accessToken: string,
  symbolId: number,
  startTime: string,
  endTime: string,
  interval: 'OneMinute' | 'TwoMinutes' | 'ThreeMinutes' | 'FourMinutes' | 'FiveMinutes' | 'TenMinutes' | 'FifteenMinutes' | 'TwentyMinutes' | 'HalfHour' | 'OneHour' | 'TwoHours' | 'FourHours' | 'OneDay' | 'OneWeek' | 'OneMonth' | 'OneYear' = 'OneDay'
): Promise<QuestradeCandlesResponse> {
  const params = new URLSearchParams();
  params.append('startTime', startTime);
  params.append('endTime', endTime);
  params.append('interval', interval);
  
  return questradeRequest<QuestradeCandlesResponse>(
    apiServerUrl,
    accessToken,
    `/v1/markets/candles/${symbolId}?${params.toString()}`
  );
}

/**
 * Encrypt tokens for storage
 */
export function encryptTokens(accessToken: string, refreshToken: string) {
  return {
    encryptedAccessToken: encrypt(accessToken),
    encryptedRefreshToken: encrypt(refreshToken),
  };
}

/**
 * Decrypt tokens from storage
 */
export function decryptTokens(
  encryptedAccessToken: string,
  encryptedRefreshToken: string
) {
  return {
    accessToken: decrypt(encryptedAccessToken),
    refreshToken: decrypt(encryptedRefreshToken),
  };
}

