/**
 * Plaid Webhook Endpoint
 * Receives webhooks from Plaid and processes them
 * Phase C: Automatic sync via webhooks
 */

import { NextRequest, NextResponse } from 'next/server';
import { makePlaidWebhookService } from '@/src/application/plaid/plaid.factory';
import { AppError } from '@/src/application/shared/app-error';
import { headers } from 'next/headers';
import { logger } from '@/lib/utils/logger';

/**
 * Check if Plaid is enabled
 */
function isPlaidEnabled(): boolean {
  return process.env.PLAID_ENABLED !== 'false';
}

export async function POST(request: NextRequest) {
  try {
    // Check feature flag
    if (!isPlaidEnabled()) {
      logger.warn('[Plaid Webhook] Plaid integration is disabled');
      return NextResponse.json(
        { error: 'Plaid integration is currently disabled' },
        { status: 503 }
      );
    }

    logger.info('[Plaid Webhook] Webhook endpoint called');

    // Get raw body for signature verification
    const body = await request.text();
    
    if (!body) {
      logger.error('[Plaid Webhook] Empty request body');
      return NextResponse.json(
        { error: 'Empty request body' },
        { status: 400 }
      );
    }

    // Get Plaid-Verification header
    const headersList = await headers();
    const verificationHeader = headersList.get('plaid-verification');

    if (!verificationHeader) {
      logger.error('[Plaid Webhook] Missing Plaid-Verification header');
      return NextResponse.json(
        { error: 'Missing Plaid-Verification header' },
        { status: 400 }
      );
    }

    // Verify webhook signature and parse event
    const webhookService = makePlaidWebhookService();
    let event;
    try {
      logger.info('[Plaid Webhook] Verifying webhook signature...');
      event = await webhookService.verifyWebhookSignature(body, verificationHeader);
      logger.info('[Plaid Webhook] Webhook signature verified successfully', {
        webhookType: event.webhookType,
        webhookCode: event.webhookCode,
        itemId: event.itemId,
      });
    } catch (err) {
      logger.error('[Plaid Webhook] Webhook signature verification failed', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      return NextResponse.json(
        { error: 'Webhook signature verification failed' },
        { status: 400 }
      );
    }

    // Handle the event (with idempotency check inside service)
    logger.info('[Plaid Webhook] Handling webhook event', {
      webhookType: event.webhookType,
      webhookCode: event.webhookCode,
      itemId: event.itemId,
    });

    // Process webhook asynchronously (don't block response)
    // Note: We still await it to catch immediate errors, but processing is async
    const result = await webhookService.handleWebhookEvent(event);

    if (!result.success) {
      logger.error('[Plaid Webhook] Webhook event handling failed', {
        error: result.error,
        webhookType: event.webhookType,
        webhookCode: event.webhookCode,
        itemId: event.itemId,
      });
      // Return 200 anyway to acknowledge receipt (Plaid will retry if needed)
      // But log the error for monitoring
      return NextResponse.json(
        { 
          received: true, 
          processed: false,
          error: result.error 
        },
        { status: 200 }
      );
    }

    logger.info('[Plaid Webhook] Webhook event handled successfully (idempotent)', {
      webhookType: event.webhookType,
      webhookCode: event.webhookCode,
      itemId: event.itemId,
    });

    // Always return 200 to acknowledge receipt
    // Plaid will retry if we return an error status
    return NextResponse.json({ 
      received: true,
      processed: true,
    });
  } catch (error) {
    logger.error('[Plaid Webhook] Error processing webhook', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    if (error instanceof AppError) {
      // Still return 200 to acknowledge receipt, but log the error
      return NextResponse.json(
        { 
          received: true,
          processed: false,
          error: error.message 
        },
        { status: 200 }
      );
    }

    // Unknown error - return 200 to acknowledge receipt
    // Plaid will retry if needed based on their retry logic
    return NextResponse.json(
      { 
        received: true,
        processed: false,
        error: 'Failed to process webhook' 
      },
      { status: 200 }
    );
  }
}
