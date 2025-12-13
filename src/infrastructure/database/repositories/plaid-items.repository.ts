/**
 * Plaid Items Repository
 * Data access layer for plaid_items - only handles database operations
 * No business logic here
 */

import { createServerClient } from '../supabase-server';
import { PlaidItem } from '@/src/domain/plaid/plaid.types';
import { encrypt, decrypt } from '@/src/infrastructure/utils/encryption';
import { logger } from '@/lib/utils/logger';

export interface PlaidItemRow {
  id: string;
  user_id: string;
  item_id: string;
  access_token_encrypted: string;
  institution_id: string | null;
  institution_name: string | null;
  status: string;
  error_code: string | null;
  error_message: string | null;
  consent_expires_at: string | null;
  last_successful_update: string | null;
  is_syncing: boolean;
  sync_started_at: string | null;
  transactions_cursor: string | null;
  created_at: string;
  updated_at: string;
}

export class PlaidItemsRepository {
  /**
   * Create a new plaid item
   * Access token is encrypted before storage
   */
  async create(data: {
    userId: string;
    itemId: string;
    accessToken: string; // Plain text - will be encrypted
    institutionId?: string | null;
    institutionName?: string | null;
    status?: string;
  }): Promise<PlaidItemRow> {
    const supabase = await createServerClient();

    // Encrypt access token before storage
    const accessTokenEncrypted = encrypt(data.accessToken);

    const now = new Date().toISOString();

    const { data: item, error } = await supabase
      .from('plaid_items')
      .insert({
        user_id: data.userId,
        item_id: data.itemId,
        access_token_encrypted: accessTokenEncrypted,
        institution_id: data.institutionId || null,
        institution_name: data.institutionName || null,
        status: data.status || 'good',
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      logger.error('[PlaidItemsRepository] Error creating plaid item:', error);
      throw new Error(`Failed to create plaid item: ${error.message}`);
    }

    return item as PlaidItemRow;
  }

  /**
   * Find plaid item by item_id (Plaid's item_id)
   */
  async findByItemId(itemId: string): Promise<PlaidItemRow | null> {
    const supabase = await createServerClient();

    const { data: item, error } = await supabase
      .from('plaid_items')
      .select('*')
      .eq('item_id', itemId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      logger.error('[PlaidItemsRepository] Error finding plaid item by item_id:', error);
      throw new Error(`Failed to find plaid item: ${error.message}`);
    }

    return item as PlaidItemRow;
  }

  /**
   * Find all plaid items for a user
   */
  async findByUserId(userId: string): Promise<PlaidItemRow[]> {
    const supabase = await createServerClient();

    const { data: items, error } = await supabase
      .from('plaid_items')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('[PlaidItemsRepository] Error finding plaid items by user_id:', error);
      throw new Error(`Failed to find plaid items: ${error.message}`);
    }

    return (items || []) as PlaidItemRow[];
  }

  /**
   * Update a plaid item
   * If accessToken is provided, it will be encrypted before storage
   */
  async update(
    itemId: string,
    data: Partial<{
      status: string;
      errorCode: string | null;
      errorMessage: string | null;
      accessToken: string; // Plain text - will be encrypted if provided
      lastSuccessfulUpdate: Date | string | null;
      isSyncing: boolean;
      syncStartedAt: Date | string | null;
      consentExpiresAt: Date | string | null;
      transactionsCursor: string | null;
    }>
  ): Promise<PlaidItemRow> {
    const supabase = await createServerClient();

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (data.status !== undefined) {
      updateData.status = data.status;
    }
    if (data.errorCode !== undefined) {
      updateData.error_code = data.errorCode;
    }
    if (data.errorMessage !== undefined) {
      updateData.error_message = data.errorMessage;
    }
    if (data.accessToken !== undefined) {
      // Encrypt access token before storage
      updateData.access_token_encrypted = encrypt(data.accessToken);
    }
    if (data.lastSuccessfulUpdate !== undefined) {
      updateData.last_successful_update = data.lastSuccessfulUpdate instanceof Date
        ? data.lastSuccessfulUpdate.toISOString()
        : data.lastSuccessfulUpdate;
    }
    if (data.isSyncing !== undefined) {
      updateData.is_syncing = data.isSyncing;
    }
    if (data.syncStartedAt !== undefined) {
      updateData.sync_started_at = data.syncStartedAt instanceof Date
        ? data.syncStartedAt.toISOString()
        : data.syncStartedAt;
    }
    if (data.consentExpiresAt !== undefined) {
      updateData.consent_expires_at = data.consentExpiresAt instanceof Date
        ? data.consentExpiresAt.toISOString()
        : data.consentExpiresAt;
    }
    if (data.transactionsCursor !== undefined) {
      updateData.transactions_cursor = data.transactionsCursor;
    }

    const { data: item, error } = await supabase
      .from('plaid_items')
      .update(updateData)
      .eq('item_id', itemId)
      .select()
      .single();

    if (error) {
      logger.error('[PlaidItemsRepository] Error updating plaid item:', error);
      throw new Error(`Failed to update plaid item: ${error.message}`);
    }

    return item as PlaidItemRow;
  }

  /**
   * Delete a plaid item
   */
  async delete(itemId: string): Promise<void> {
    const supabase = await createServerClient();

    const { error } = await supabase
      .from('plaid_items')
      .delete()
      .eq('item_id', itemId);

    if (error) {
      logger.error('[PlaidItemsRepository] Error deleting plaid item:', error);
      throw new Error(`Failed to delete plaid item: ${error.message}`);
    }
  }

  /**
   * Get decrypted access token for an item
   * This is a helper method that should be used carefully
   */
  async getAccessToken(itemId: string): Promise<string | null> {
    const item = await this.findByItemId(itemId);
    if (!item) {
      return null;
    }

    try {
      return decrypt(item.access_token_encrypted);
    } catch (error) {
      logger.error('[PlaidItemsRepository] Error decrypting access token:', error);
      return null;
    }
  }
}
