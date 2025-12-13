/**
 * Plaid Webhook Service
 * Business logic for processing Plaid webhooks
 * Handles webhook signature verification and event processing with idempotency
 */

import { WebhookEventsRepository } from '@/src/infrastructure/database/repositories/webhook-events.repository';
import { PlaidItemsRepository } from '@/src/infrastructure/database/repositories/plaid-items.repository';
import { PlaidService } from './plaid.service';
import { getWebhookVerificationKey } from '@/src/infrastructure/external/plaid/plaid-client';
import { PlaidWebhookEvent } from '@/src/domain/plaid/plaid.types';
import { plaidWebhookEventSchema } from '@/src/domain/plaid/plaid.validations';
import { logger } from '@/lib/utils/logger';
import { AppError } from '@/src/application/shared/app-error';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';

export interface WebhookEventResult {
  success: boolean;
  error?: string;
}

export class PlaidWebhookService {
  constructor(
    private webhookEventsRepository: WebhookEventsRepository,
    private plaidItemsRepository: PlaidItemsRepository,
    private plaidService: PlaidService
  ) {}

  /**
   * Verify webhook signature using Plaid's JWT verification
   * Plaid uses JWT with ES256 algorithm and includes a key ID (kid) in the header
   */
  async verifyWebhookSignature(
    body: string,
    verificationHeader: string
  ): Promise<PlaidWebhookEvent> {
    if (!verificationHeader) {
      throw new AppError('Missing Plaid-Verification header', 400);
    }

    try {
      // Decode JWT without verifying signature first to get the key ID
      const decoded = jwt.decode(verificationHeader, { complete: true });

      if (!decoded || typeof decoded === 'string') {
        throw new AppError('Invalid JWT format', 400);
      }

      const header = decoded.header;
      if (header.alg !== 'ES256') {
        throw new AppError(`Invalid algorithm: expected ES256, got ${header.alg}`, 400);
      }

      if (!header.kid) {
        throw new AppError('Missing key ID (kid) in JWT header', 400);
      }

      // Fetch the public key from Plaid
      const publicKey = await getWebhookVerificationKey(header.kid);

      // Compute SHA-256 hash of the raw request body
      // Note: Plaid's hashing is sensitive to whitespace - use raw body as received
      const bodyHash = crypto.createHash('sha256').update(body, 'utf8').digest('hex');

      // Verify the JWT signature
      let payload: any;
      try {
        payload = jwt.verify(verificationHeader, publicKey, {
          algorithms: ['ES256'],
        });
      } catch (error: any) {
        logger.error('[PlaidWebhookService] JWT signature verification failed', {
          error: error?.message || 'Unknown error',
        });
        throw new AppError('Invalid JWT signature', 400);
      }

      // Compare the computed hash with the one in the JWT payload
      if (payload.request_body_sha256 !== bodyHash) {
        logger.error('[PlaidWebhookService] Request body hash mismatch', {
          expected: payload.request_body_sha256,
          computed: bodyHash,
        });
        throw new AppError('Request body hash mismatch', 400);
      }

      // Parse and validate the webhook payload
      const webhookPayload = JSON.parse(body);
      const validatedEvent = plaidWebhookEventSchema.parse(webhookPayload);

      return validatedEvent;
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }

      logger.error('[PlaidWebhookService] Error verifying webhook signature', {
        error: error?.message || 'Unknown error',
      });
      throw new AppError('Failed to verify webhook signature', 400);
    }
  }

  /**
   * Handle webhook event with idempotency
   * Prevents duplicate processing of the same webhook event
   */
  async handleWebhookEvent(event: PlaidWebhookEvent): Promise<WebhookEventResult> {
    try {
      // Create a unique event ID from webhook type, code, and item ID
      // Plaid doesn't provide a unique event ID, so we create one from the payload
      const eventId = this.createEventId(event);

      logger.info('[PlaidWebhookService] Webhook event received', {
        webhookType: event.webhookType,
        webhookCode: event.webhookCode,
        itemId: event.itemId,
        eventId,
      });

      // Check if event was already processed (idempotency)
      const existingEvent = await this.webhookEventsRepository.findByEventId(eventId);

      if (existingEvent) {
        if (existingEvent.result === 'success') {
          logger.info('[PlaidWebhookService] Webhook event already processed successfully, skipping', {
            eventId,
            processedAt: existingEvent.processed_at,
          });
          return { success: true };
        } else {
          logger.warn('[PlaidWebhookService] Webhook event was previously processed with error, retrying', {
            eventId,
            previousResult: existingEvent.result,
            previousError: existingEvent.error_message,
          });
          // Continue to process again if it previously failed
        }
      }

      // Process the event
      let result: 'success' | 'error' = 'success';
      let errorMessage: string | null = null;

      try {
        // Handle different webhook types
        switch (event.webhookType) {
          case 'TRANSACTIONS':
            await this.handleTransactionsWebhook(event);
            break;
          case 'ITEM':
            await this.handleItemWebhook(event);
            break;
          case 'HOLDINGS':
            await this.handleHoldingsWebhook(event);
            break;
          default:
            logger.info('[PlaidWebhookService] Unhandled webhook type, logging for reference', {
              webhookType: event.webhookType,
              webhookCode: event.webhookCode,
              itemId: event.itemId,
            });
            // Don't fail for unhandled events, just log them
        }

        // Record successful processing
        await this.webhookEventsRepository.create({
          eventId,
          eventType: `${event.webhookType}:${event.webhookCode}`,
          result: 'success',
          metadata: {
            webhookType: event.webhookType,
            webhookCode: event.webhookCode,
            itemId: event.itemId,
            environment: event.environment,
            newTransactions: event.newTransactions,
            removedTransactions: event.removedTransactions,
            accountIds: event.accountIds,
          },
        });

        return { success: true };
      } catch (processingError) {
        result = 'error';
        errorMessage = processingError instanceof Error ? processingError.message : 'Unknown error';

        logger.error('[PlaidWebhookService] Error processing webhook event', {
          eventId,
          webhookType: event.webhookType,
          webhookCode: event.webhookCode,
          itemId: event.itemId,
          error: errorMessage,
        });

        // Record failed processing
        await this.webhookEventsRepository.create({
          eventId,
          eventType: `${event.webhookType}:${event.webhookCode}`,
          result: 'error',
          errorMessage,
          metadata: {
            webhookType: event.webhookType,
            webhookCode: event.webhookCode,
            itemId: event.itemId,
            environment: event.environment,
            error: errorMessage,
          },
        });

        return {
          success: false,
          error: errorMessage,
        };
      }
    } catch (error) {
      logger.error('[PlaidWebhookService] Error handling webhook event', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle TRANSACTIONS webhook events
   * Triggers sync of transactions for the affected item
   */
  private async handleTransactionsWebhook(event: PlaidWebhookEvent): Promise<void> {
    const { itemId, webhookCode, newTransactions, removedTransactions, accountIds } = event;

    logger.info('[PlaidWebhookService] Processing TRANSACTIONS webhook', {
      itemId,
      webhookCode,
      newTransactions,
      removedTransactions: removedTransactions?.length || 0,
      accountIds: accountIds?.length || 0,
    });

    // Get the item to verify it exists and get userId
    const item = await this.plaidItemsRepository.findByItemId(itemId);
    if (!item) {
      logger.warn('[PlaidWebhookService] Item not found for TRANSACTIONS webhook', { itemId });
      throw new AppError(`Item ${itemId} not found`, 404);
    }

    // Handle different transaction webhook codes
    switch (webhookCode) {
      case 'INITIAL_UPDATE':
      case 'HISTORICAL_UPDATE':
      case 'DEFAULT_UPDATE':
        // Sync transactions for the item
        // If accountIds are specified, sync only those accounts
        if (accountIds && accountIds.length > 0) {
          // For webhooks, we need to sync accounts differently since syncAccount requires auth
          // We'll sync the entire item instead, which will sync all accounts
          // The accountIds filter is informational - Plaid tells us which accounts have updates
          logger.info('[PlaidWebhookService] Syncing item (accountIds provided for reference)', {
            itemId,
            accountIds,
          });
        }

        // Sync entire item using webhook-specific method
        try {
          const result = await this.plaidService.syncItemForWebhook(itemId);
          
          logger.info('[PlaidWebhookService] Successfully synced item from TRANSACTIONS webhook', {
            itemId,
            webhookCode,
            newTransactions,
            transactionsCreated: result.transactionsCreated,
            transactionsSkipped: result.transactionsSkipped,
            accountsSynced: result.accountsSynced,
          });
        } catch (error: any) {
          logger.error('[PlaidWebhookService] Error syncing item from TRANSACTIONS webhook', {
            itemId,
            error: error?.message || 'Unknown error',
          });
          // Don't throw - we've logged the error, webhook processing should be resilient
          // Update timestamp anyway so we know the webhook was received
          await this.plaidItemsRepository.update(itemId, {
            lastSuccessfulUpdate: new Date(),
          });
        }
        break;

      case 'TRANSACTIONS_REMOVED':
        // Handle removed transactions
        // For now, we don't delete transactions from our database when Plaid removes them
        // This is a design decision - we keep historical data even if Plaid removes it
        logger.info('[PlaidWebhookService] TRANSACTIONS_REMOVED webhook received', {
          itemId,
          removedCount: removedTransactions?.length || 0,
        });
        break;

      default:
        logger.warn('[PlaidWebhookService] Unknown TRANSACTIONS webhook code', {
          itemId,
          webhookCode,
        });
    }
  }

  /**
   * Handle ITEM webhook events
   * Updates item status based on error codes
   */
  private async handleItemWebhook(event: PlaidWebhookEvent): Promise<void> {
    const { itemId, webhookCode, error } = event;

    logger.info('[PlaidWebhookService] Processing ITEM webhook', {
      itemId,
      webhookCode,
      hasError: !!error,
    });

    // Get the item to verify it exists
    const item = await this.plaidItemsRepository.findByItemId(itemId);
    if (!item) {
      logger.warn('[PlaidWebhookService] Item not found for ITEM webhook', { itemId });
      throw new AppError(`Item ${itemId} not found`, 404);
    }

    switch (webhookCode) {
      case 'ERROR':
        // Update item status to error
        if (error) {
          await this.plaidItemsRepository.update(itemId, {
            status: 'error',
            errorCode: error.errorCode,
            errorMessage: error.errorMessage,
          });

          logger.info('[PlaidWebhookService] Updated item status to error', {
            itemId,
            errorCode: error.errorCode,
            errorMessage: error.errorMessage,
          });
        }
        break;

      case 'PENDING_EXPIRATION':
        // Update item status to pending_expiration
        await this.plaidItemsRepository.update(itemId, {
          status: 'pending_expiration',
        });

        logger.info('[PlaidWebhookService] Updated item status to pending_expiration', {
          itemId,
        });
        break;

      case 'USER_PERMISSION_REVOKED':
        // User revoked access - mark item as error
        await this.plaidItemsRepository.update(itemId, {
          status: 'error',
          errorCode: 'USER_PERMISSION_REVOKED',
          errorMessage: 'User revoked access to this item',
        });

        logger.info('[PlaidWebhookService] User permission revoked for item', {
          itemId,
        });
        break;

      case 'WEBHOOK_UPDATE_ACKNOWLEDGED':
        // Plaid acknowledged our webhook update - no action needed
        logger.info('[PlaidWebhookService] Webhook update acknowledged', {
          itemId,
        });
        break;

      default:
        logger.warn('[PlaidWebhookService] Unknown ITEM webhook code', {
          itemId,
          webhookCode,
        });
    }
  }

  /**
   * Handle HOLDINGS webhook events
   * Phase D: Triggers refresh of investment holdings
   */
  private async handleHoldingsWebhook(event: PlaidWebhookEvent): Promise<void> {
    const { itemId, webhookCode } = event;

    logger.info('[PlaidWebhookService] Processing HOLDINGS webhook', {
      itemId,
      webhookCode,
    });

    // Get the item to verify it exists
    const item = await this.plaidItemsRepository.findByItemId(itemId);
    if (!item) {
      logger.warn('[PlaidWebhookService] Item not found for HOLDINGS webhook', { itemId });
      throw new AppError(`Item ${itemId} not found`, 404);
    }

    // For HOLDINGS webhooks, we typically want to refresh investment data
    // The investments refresh service will handle the actual sync
    // We just update the last_successful_update timestamp
    await this.plaidItemsRepository.update(itemId, {
      lastSuccessfulUpdate: new Date(),
    });

    logger.info('[PlaidWebhookService] Successfully processed HOLDINGS webhook', {
      itemId,
      webhookCode,
    });
  }

  /**
   * Create a unique event ID from webhook payload
   * Since Plaid doesn't provide a unique event ID, we create one from the payload
   */
  private createEventId(event: PlaidWebhookEvent): string {
    // Create a deterministic ID from webhook properties
    // Include timestamp to handle duplicate events at different times
    const timestamp = new Date().toISOString().split('T')[0]; // Use date to group events
    const parts = [
      event.webhookType,
      event.webhookCode,
      event.itemId,
      timestamp,
      event.newTransactions?.toString() || '',
      event.removedTransactions?.join(',') || '',
      event.accountIds?.join(',') || '',
    ];

    // Create a hash of the parts to create a unique ID
    const hash = crypto.createHash('sha256').update(parts.join('|')).digest('hex');
    return `plaid_${hash.substring(0, 32)}`;
  }
}
