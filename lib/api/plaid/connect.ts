"use server";

import { plaidClient } from './index';
import { createServerClient } from '@/lib/supabase-server';
import { formatTimestamp } from '@/lib/utils/timestamp';
import { CountryCode, Products } from 'plaid';

/**
 * Get institution logo from Plaid
 * Supports both US and Canada
 */
async function getInstitutionLogo(institutionId: string, countryCode?: CountryCode): Promise<string | null> {
  try {
    const countryCodes = countryCode ? [countryCode] : [CountryCode.Us, CountryCode.Ca];
    
    // Try US first, then Canada
    for (const country of countryCodes) {
      try {
        const response = await plaidClient.institutionsGetById({
          institution_id: institutionId,
          country_codes: [country],
          options: {
            include_optional_metadata: true,
          },
        });

        const institution = response.data.institution;
        return institution.logo || null;
      } catch (err) {
        // Try next country if this one fails
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching institution logo:', error);
    return null;
  }
}

/**
 * Search for Plaid institutions
 * @param query - Search query (institution name). Use empty string to get all institutions
 * @param countryCode - Country code (US or CA)
 * @param products - Products to filter by (optional)
 * @param count - Number of results to return (default 500, max 500)
 * @param offset - Offset for pagination (default 0)
 */
export async function searchInstitutions(
  query: string = '',
  countryCode: CountryCode = CountryCode.Us,
  products?: Products[],
  count: number = 500,
  offset: number = 0
): Promise<{
  institutions: Array<{
    institution_id: string;
    name: string;
    products: string[];
    country_codes: string[];
    url?: string;
    primary_color?: string;
    logo?: string;
    routing_numbers?: string[];
    oauth?: boolean;
  }>;
  total: number;
}> {
  try {
    const response = await plaidClient.institutionsSearch({
      query,
      country_codes: [countryCode],
      products: products || undefined,
      options: {
        include_optional_metadata: true,
      },
    });

    const institutions = response.data.institutions.map((inst) => ({
      institution_id: inst.institution_id,
      name: inst.name,
      products: inst.products || [],
      country_codes: inst.country_codes || [],
      url: inst.url || undefined,
      primary_color: inst.primary_color || undefined,
      logo: inst.logo || undefined,
      routing_numbers: inst.routing_numbers || undefined,
      oauth: inst.oauth || false,
    }));

    return {
      institutions,
      total: institutions.length,
    };
  } catch (error: any) {
    console.error('Error searching institutions:', error);
    throw new Error(`Failed to search institutions: ${error.response?.data?.error_message || error.message}`);
  }
}

/**
 * Create a Plaid Link token for the current user
 * @param userId - User ID
 * @param accountType - 'bank' for regular bank accounts (Transactions), 'investment' for investment accounts (Investments)
 * @param countryCode - Country code (default: US). Use CountryCode.Ca for Canada
 */
export async function createLinkToken(
  userId: string, 
  accountType: 'bank' | 'investment' = 'bank',
  countryCode: CountryCode = CountryCode.Us
): Promise<string> {
  try {
    // Check if Plaid credentials are configured
    if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
      console.error('Plaid credentials not configured. Please set PLAID_CLIENT_ID and PLAID_SECRET environment variables.');
      throw new Error('Plaid credentials not configured. Please contact support.');
    }

    // Build products array based on account type
    // For bank accounts: use Transactions (shows regular banks)
    // For investment accounts: use Investments (shows brokers)
    const products: Array<Products> = [];
    
    if (accountType === 'bank') {
      products.push(Products.Transactions);
    } else if (accountType === 'investment') {
      products.push(Products.Investments);
    }
    
    // Only add Liabilities if explicitly enabled (some Plaid accounts don't have access)
    // You can enable this by setting PLAID_ENABLE_LIABILITIES=true in environment
    if (process.env.PLAID_ENABLE_LIABILITIES === 'true' && accountType === 'bank') {
      products.push(Products.Liabilities);
    }

    // Configure Link to show all available institutions
    // This ensures both investment and regular bank accounts are available
    const linkTokenConfig: any = {
      user: {
        client_user_id: userId,
      },
      client_name: 'Spare Finance',
      products: products,
      country_codes: [countryCode],
      language: 'en',
      // Configure Link to show all institutions that support at least one of our products
      // This allows users to see both regular banks (Transactions) and investment brokers (Investments)
      // The Link UI will automatically filter to show institutions that support the requested products
    };

    // Add transactions configuration for bank accounts
    // This specifies how many days of transaction history to request
    // Default is 90 days, max is 730 days (2 years)
    if (accountType === 'bank') {
      linkTokenConfig.transactions = {
        days_requested: 90, // Request 90 days of transaction history
      };
    }

    // Add webhook URL if configured
    const webhookUrl = process.env.PLAID_WEBHOOK_URL || 
      (process.env.NEXT_PUBLIC_APP_URL 
        ? `${process.env.NEXT_PUBLIC_APP_URL}/api/plaid/webhook`
        : undefined);

    if (webhookUrl) {
      linkTokenConfig.webhook = webhookUrl;
      console.log('[PLAID] Using webhook URL:', webhookUrl);
    }

    const response = await plaidClient.linkTokenCreate(linkTokenConfig);

    if (!response.data.link_token) {
      throw new Error('Failed to create link token');
    }

    return response.data.link_token;
  } catch (error: any) {
    console.error('Error creating Plaid link token:', error);
    
    // Provide more specific error messages
    if (error.response?.data) {
      console.error('Plaid API error:', error.response.data);
      throw new Error(`Plaid API error: ${error.response.data.error_message || error.response.data.error_code || 'Unknown error'}`);
    }
    
    if (error.message?.includes('credentials')) {
      throw error;
    }
    
    throw new Error('Failed to create link token. Please check your Plaid configuration.');
  }
}

/**
 * Exchange public token for access token and store connection
 */
export async function exchangePublicToken(
  publicToken: string,
  metadata: {
    institution: {
      institution_id: string;
      name: string;
    };
  }
): Promise<{
  itemId: string;
  accessToken: string;
  accounts: Array<{
    account_id: string;
    name: string;
    type: string;
    subtype: string | null;
    balances: {
      available: number | null;
      current: number | null;
      iso_currency_code: string | null;
      unofficial_currency_code: string | null;
    };
  }>;
}> {
  try {
    // Exchange public token for access token
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    // Get accounts metadata (name, type, subtype, etc.) using /accounts/get
    // Note: /accounts/get returns cached information, not real-time balances
    // According to Plaid docs: "The balance returned will reflect the balance 
    // at the time of the last successful Item update"
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    // Try to get real-time balances using /accounts/balance/get
    // This endpoint provides real-time balance information (not cached)
    // According to Plaid docs: "For realtime balance information, use the paid 
    // endpoints /accounts/balance/get or /signal/evaluate instead"
    // Note: This endpoint may not be available in all environments or may require
    // specific permissions. If it fails, we'll fall back to using balances from /accounts/get
    let balanceMap = new Map<string, {
      available: number | null;
      current: number | null;
      limit: number | null;
      iso_currency_code: string | null;
      unofficial_currency_code: string | null;
    }>();

    try {
      const balanceResponse = await plaidClient.accountsBalanceGet({
        access_token: accessToken,
      });

      // Create a map of account_id to real-time balance data
      balanceMap = new Map(
        balanceResponse.data.accounts.map((acc) => [
          acc.account_id,
          {
            available: acc.balances?.available ?? null,
            current: acc.balances?.current ?? null,
            limit: acc.balances?.limit ?? null,
            iso_currency_code: acc.balances?.iso_currency_code ?? null,
            unofficial_currency_code: acc.balances?.unofficial_currency_code ?? null,
          },
        ])
      );
    } catch (balanceError: any) {
      // Log the error but don't fail the entire token exchange
      // The /accounts/balance/get endpoint may not be available in sandbox mode
      // or may require specific permissions/products
      console.warn('[PLAID] Failed to get real-time balances, using cached balances from /accounts/get:', {
        error: balanceError.message,
        status: balanceError.response?.status,
        errorCode: balanceError.response?.data?.error_code,
        errorMessage: balanceError.response?.data?.error_message,
      });
      // balanceMap will remain empty, and we'll use balances from accountsGet below
    }

    // Combine account metadata with real-time balance data (or fallback to cached balances)
    const accounts = accountsResponse.data.accounts.map((account) => {
      // Try to get real-time balance first, fallback to cached balance from accountsGet
      const realTimeBalance = balanceMap.get(account.account_id) || {
        available: account.balances?.available ?? null,
        current: account.balances?.current ?? null,
        limit: account.balances?.limit ?? null,
        iso_currency_code: account.balances?.iso_currency_code ?? null,
        unofficial_currency_code: account.balances?.unofficial_currency_code ?? null,
      };

      return {
        account_id: account.account_id,
        name: account.name,
        type: account.type || 'other',
        subtype: account.subtype || null,
        balances: {
          available: realTimeBalance.available,
          current: realTimeBalance.current,
          limit: realTimeBalance.limit,
          iso_currency_code: realTimeBalance.iso_currency_code,
          unofficial_currency_code: realTimeBalance.unofficial_currency_code,
        },
        mask: account.mask || null,
        official_name: account.official_name || null,
        verification_status: account.verification_status || null,
        // Additional Plaid fields
        persistent_account_id: (account as any).persistent_account_id || null,
        holder_category: (account as any).holder_category || null,
        verification_name: (account as any).verification_name || null,
      };
    });

    // Store Plaid connection in database
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const now = formatTimestamp(new Date());
    const connectionId = crypto.randomUUID();

    // Get institution logo (try both US and Canada)
    // Note: We don't know the country at this point, so try both
    const institutionLogo = await getInstitutionLogo(metadata.institution.institution_id);

    // Check if connection already exists for this item
    const { data: existingConnection } = await supabase
      .from('PlaidConnection')
      .select('id')
      .eq('itemId', itemId)
      .single();

    if (existingConnection) {
      // Update existing connection
      const { error } = await supabase
        .from('PlaidConnection')
        .update({
          accessToken,
          institutionId: metadata.institution.institution_id,
          institutionName: metadata.institution.name,
          institutionLogo,
          updatedAt: now,
          errorCode: null,
          errorMessage: null,
        })
        .eq('id', existingConnection.id);

      if (error) {
        console.error('Error updating Plaid connection:', error);
        throw new Error('Failed to update Plaid connection');
      }
    } else {
      // Create new connection
      const { error } = await supabase
        .from('PlaidConnection')
        .insert({
          id: connectionId,
          userId: user.id,
          itemId,
          accessToken,
          institutionId: metadata.institution.institution_id,
          institutionName: metadata.institution.name,
          institutionLogo,
          createdAt: now,
          updatedAt: now,
        });

      if (error) {
        console.error('Error creating Plaid connection:', error);
        throw new Error('Failed to create Plaid connection');
      }
    }

    return {
      itemId,
      accessToken,
      accounts,
    };
  } catch (error: any) {
    console.error('Error exchanging public token:', error);
    
    // Provide more detailed error information
    if (error.response?.data) {
      const plaidError = error.response.data;
      console.error('Plaid API error details:', {
        error_code: plaidError.error_code,
        error_message: plaidError.error_message,
        error_type: plaidError.error_type,
        status: error.response.status,
      });
      
      // Throw a more descriptive error
      throw new Error(
        `Failed to exchange public token: ${plaidError.error_message || plaidError.error_code || 'Unknown Plaid error'}`
      );
    }
    
    throw new Error(`Failed to exchange public token: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Get access token for a Plaid item
 */
export async function getAccessToken(itemId: string): Promise<string | null> {
  try {
    const supabase = await createServerClient();
    
    const { data: connection, error } = await supabase
      .from('PlaidConnection')
      .select('accessToken')
      .eq('itemId', itemId)
      .single();

    if (error || !connection) {
      console.error('Error fetching access token:', error);
      return null;
    }

    return connection.accessToken;
  } catch (error) {
    console.error('Error getting access token:', error);
    return null;
  }
}

/**
 * Sync account balances from Plaid using /accounts/balance/get
 * This endpoint provides real-time balance information (not cached)
 * 
 * According to Plaid docs:
 * - /accounts/balance/get returns real-time balance information
 * - /accounts/get may return cached balance information
 * - The current field represents "The total amount of funds in or owed by the account"
 * 
 * @param itemId - The Plaid item ID
 * @param accessToken - The Plaid access token
 * @returns Object with counts of synced and errors
 */
export async function syncAccountBalances(
  itemId: string,
  accessToken: string
): Promise<{
  synced: number;
  errors: number;
}> {
  const supabase = await createServerClient();
  let synced = 0;
  let errors = 0;

  try {
    // Use /accounts/balance/get for real-time balance information
    // This is recommended by Plaid for getting current balances
    const balanceResponse = await plaidClient.accountsBalanceGet({
      access_token: accessToken,
    });

    const accounts = balanceResponse.data.accounts || [];

    if (accounts.length === 0) {
      console.log('[PLAID BALANCE SYNC] No accounts found for item:', itemId);
      return { synced: 0, errors: 0 };
    }

    console.log(`[PLAID BALANCE SYNC] Found ${accounts.length} accounts to sync balances for item:`, itemId);

    // Get all accounts for this item from our database
    const { data: dbAccounts } = await supabase
      .from('Account')
      .select('id, plaidAccountId, type')
      .eq('plaidItemId', itemId)
      .eq('isConnected', true);

    if (!dbAccounts || dbAccounts.length === 0) {
      console.log('[PLAID BALANCE SYNC] No connected accounts found in database for item:', itemId);
      return { synced: 0, errors: 0 };
    }

    // Create a map of Plaid account ID to database account
    const accountMap = new Map(
      dbAccounts.map((acc) => [acc.plaidAccountId, acc])
    );

    const now = formatTimestamp(new Date());

    // Update balances for each account
    for (const plaidAccount of accounts) {
      const dbAccount = accountMap.get(plaidAccount.account_id);

      if (!dbAccount) {
        console.warn(`[PLAID BALANCE SYNC] Account not found in database for Plaid account ID: ${plaidAccount.account_id}`);
        continue;
      }

      try {
        // Get current balance from Plaid
        // According to BALANCE.md:
        // - current: The total amount of funds in or owed by the account
        // - available: The amount of funds available to be withdrawn (may be null)
        // - If current is null, available is guaranteed not to be null
        // - For credit accounts: positive balance = amount owed
        // - For loan accounts: positive balance = principal remaining
        // - For investment accounts: current balance = total value of assets
        const currentBalance = plaidAccount.balances?.current ?? null;
        const availableBalance = plaidAccount.balances?.available ?? null;
        const creditLimit = plaidAccount.balances?.limit ?? null;

        // Use current balance if available, otherwise fall back to available balance
        // According to Plaid docs: "If current is null this field is guaranteed not to be null"
        const balanceToUse = currentBalance !== null ? currentBalance : availableBalance;

        // Only update initialBalance for depository accounts (checking/savings)
        // For other account types, we calculate balance from transactions or use other sources
        const updateData: any = {
          updatedAt: now,
        };

        if (dbAccount.type === 'checking' || dbAccount.type === 'savings') {
          // For depository accounts, update initialBalance with current balance
          // This represents the actual balance from the bank
          if (balanceToUse !== null) {
            updateData.initialBalance = balanceToUse;
          }
        }

        // Update available balance (separate from current balance)
        // This is the amount that can be withdrawn
        if (availableBalance !== null) {
          updateData.plaidAvailableBalance = availableBalance;
        }

        // Update credit limit for credit accounts
        if (dbAccount.type === 'credit' && creditLimit !== null) {
          updateData.creditLimit = creditLimit;
        }

        // Update currency codes (mutually exclusive)
        const isoCurrencyCode = plaidAccount.balances?.iso_currency_code ?? null;
        const unofficialCurrencyCode = isoCurrencyCode 
          ? null 
          : (plaidAccount.balances?.unofficial_currency_code ?? null);
        
        if (isoCurrencyCode) {
          updateData.currencyCode = isoCurrencyCode;
          updateData.plaidUnofficialCurrencyCode = null;
        } else if (unofficialCurrencyCode) {
          updateData.currencyCode = null; // Clear ISO code if unofficial is set
          updateData.plaidUnofficialCurrencyCode = unofficialCurrencyCode;
        }

        // Update the account
        const { error: updateError } = await supabase
          .from('Account')
          .update(updateData)
          .eq('id', dbAccount.id);

        if (updateError) {
          console.error(`[PLAID BALANCE SYNC] Error updating balance for account ${dbAccount.id}:`, updateError);
          errors++;
        } else {
          synced++;
          console.log(`[PLAID BALANCE SYNC] Updated balance for account ${dbAccount.id}:`, {
            type: dbAccount.type,
            currentBalance,
            availableBalance,
            balanceToUse,
            creditLimit,
            isoCurrencyCode: isoCurrencyCode,
            unofficialCurrencyCode: unofficialCurrencyCode,
            updatedInitialBalance: updateData.initialBalance !== undefined,
            updatedAvailableBalance: updateData.plaidAvailableBalance !== undefined,
          });
        }
      } catch (error) {
        console.error(`[PLAID BALANCE SYNC] Error processing balance for account ${plaidAccount.account_id}:`, error);
        errors++;
      }
    }

    return { synced, errors };
  } catch (error: any) {
    console.error('[PLAID BALANCE SYNC] Error syncing balances:', error);
    console.error('Error details:', {
      message: error.message,
      response: error.response?.data,
    });
    throw new Error(`Failed to sync balances: ${error.message || 'Unknown error'}`);
  }
}

