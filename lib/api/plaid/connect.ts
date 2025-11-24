"use server";

import { plaidClient } from './index';
import { createServerClient } from '@/lib/supabase-server';
import { formatTimestamp } from '@/lib/utils/timestamp';
import { CountryCode, Products } from 'plaid';

/**
 * Get institution logo from Plaid
 */
async function getInstitutionLogo(institutionId: string): Promise<string | null> {
  try {
    const response = await plaidClient.institutionsGetById({
      institution_id: institutionId,
      country_codes: [CountryCode.Us],
      options: {
        include_optional_metadata: true,
      },
    });

    const institution = response.data.institution;
    return institution.logo || null;
  } catch (error) {
    console.error('Error fetching institution logo:', error);
    return null;
  }
}

/**
 * Create a Plaid Link token for the current user
 * @param userId - User ID
 * @param accountType - 'bank' for regular bank accounts (Transactions), 'investment' for investment accounts (Investments)
 */
export async function createLinkToken(userId: string, accountType: 'bank' | 'investment' = 'bank'): Promise<string> {
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
      country_codes: [CountryCode.Us],
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

    // Get accounts for this item
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    const accounts = accountsResponse.data.accounts.map((account) => ({
      account_id: account.account_id,
      name: account.name,
      type: account.type || 'other',
      subtype: account.subtype || null,
      balances: {
        available: account.balances.available,
        current: account.balances.current,
      },
      mask: account.mask || null,
      official_name: account.official_name || null,
      verification_status: account.verification_status || null,
    }));

    // Store Plaid connection in database
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const now = formatTimestamp(new Date());
    const connectionId = crypto.randomUUID();

    // Get institution logo
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
  } catch (error) {
    console.error('Error exchanging public token:', error);
    throw new Error('Failed to exchange public token');
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

