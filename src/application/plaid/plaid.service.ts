/**
 * Plaid Service
 * Business logic for Plaid integration
 * Orchestrates Plaid operations including connection, sync, and institution management
 */

import { PlaidRepository } from "../../infrastructure/database/repositories/plaid.repository";
import { getPlaidClient } from "../../infrastructure/external/plaid/plaid-client";
import { PlaidConnection, PlaidInstitution, PlaidSyncResult } from "../../domain/plaid/plaid.types";
import { CountryCode, Products } from "plaid";

export class PlaidService {
  constructor(private repository: PlaidRepository) {}

  /**
   * Create a Plaid Link token
   */
  async createLinkToken(
    userId: string,
    accountType: 'bank' | 'investment' | 'both' = 'bank',
    countryCode: CountryCode = CountryCode.Us
  ): Promise<string> {
    const plaidClient = getPlaidClient();

    // Build products array based on account type
    const products: Array<Products> = [];
    
    if (accountType === 'bank' || accountType === 'both') {
      products.push(Products.Transactions);
    }
    
    if (accountType === 'investment' || accountType === 'both') {
      products.push(Products.Investments);
    }
    
    if (process.env.PLAID_ENABLE_LIABILITIES === 'true' && (accountType === 'bank' || accountType === 'both')) {
      products.push(Products.Liabilities);
    }

    const linkTokenConfig: any = {
      user: {
        client_user_id: userId,
      },
      client_name: 'Spare Finance',
      products: products,
      country_codes: [countryCode],
      language: 'en',
    };

    // Add transactions configuration for bank accounts
    if (accountType === 'bank' || accountType === 'both') {
      linkTokenConfig.transactions = {
        days_requested: 90,
      };
    }

    // Add webhook URL if configured
    const webhookUrl = process.env.PLAID_WEBHOOK_URL || 
      (process.env.NEXT_PUBLIC_APP_URL 
        ? `${process.env.NEXT_PUBLIC_APP_URL}/api/plaid/webhook`
        : undefined);

    if (webhookUrl) {
      linkTokenConfig.webhook = webhookUrl;
    }

    const response = await plaidClient.linkTokenCreate(linkTokenConfig);

    if (!response.data.link_token) {
      throw new Error('Failed to create link token');
    }

    return response.data.link_token;
  }

  /**
   * Exchange public token for access token
   */
  async exchangePublicToken(
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
    const plaidClient = getPlaidClient();

    // Exchange public token for access token
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    // Get accounts metadata
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    // Try to get real-time balances
    let balanceMap = new Map<string, any>();
    try {
      const balanceResponse = await plaidClient.accountsBalanceGet({
        access_token: accessToken,
      });

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
    } catch (error) {
      // Fallback to cached balances
      console.warn("Failed to get real-time balances, using cached balances");
    }

    // Combine account metadata with balance data
    const accounts = accountsResponse.data.accounts.map((account) => {
      const realTimeBalance = balanceMap.get(account.account_id) || {
        available: account.balances?.available ?? null,
        current: account.balances?.current ?? null,
        iso_currency_code: account.balances?.iso_currency_code ?? null,
        unofficial_currency_code: account.balances?.unofficial_currency_code ?? null,
      };

      return {
        account_id: account.account_id,
        name: account.name,
        type: account.type,
        subtype: account.subtype || null,
        balances: {
          available: realTimeBalance.available,
          current: realTimeBalance.current,
          iso_currency_code: realTimeBalance.iso_currency_code,
          unofficial_currency_code: realTimeBalance.unofficial_currency_code,
        },
      };
    });

    // Store connection in database
    await this.repository.createConnection({
      userId: metadata.institution.institution_id, // This should be passed from caller
      itemId,
      accessToken,
      institutionId: metadata.institution.institution_id,
      institutionName: metadata.institution.name,
    });

    return {
      itemId,
      accessToken,
      accounts,
    };
  }

  /**
   * Search for Plaid institutions
   */
  async searchInstitutions(
    query: string = '',
    countryCode: CountryCode = CountryCode.Us,
    products?: Products[],
    count: number = 500,
    offset: number = 0
  ): Promise<{
    institutions: PlaidInstitution[];
    total: number;
  }> {
    const plaidClient = getPlaidClient();

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
  }

  /**
   * Get Plaid connection by item ID
   */
  async getConnectionByItemId(itemId: string): Promise<PlaidConnection | null> {
    return this.repository.getConnectionByItemId(itemId);
  }

  /**
   * Get all Plaid connections for a user
   */
  async getConnectionsByUserId(userId: string): Promise<PlaidConnection[]> {
    return this.repository.getConnectionsByUserId(userId);
  }

  /**
   * Update transaction cursor
   */
  async updateCursor(itemId: string, cursor: string | null): Promise<void> {
    return this.repository.updateCursor(itemId, cursor);
  }

  /**
   * Delete Plaid connection
   */
  async deleteConnection(itemId: string): Promise<void> {
    return this.repository.deleteConnection(itemId);
  }
}

