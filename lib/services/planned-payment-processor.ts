"use server";

import { getPlannedPayments, markPlannedPaymentAsPaid } from "@/lib/api/planned-payments";
import { logger } from "@/src/infrastructure/utils/logger";

/**
 * Process planned payments that are due today or in the past
 * Converts them to transactions automatically
 * This should be called periodically (e.g., daily cron job or when user accesses dashboard)
 */
export async function processDuePlannedPayments(): Promise<{
  processed: number;
  errors: number;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get all scheduled planned payments with date <= today
  const result = await getPlannedPayments({
    endDate: today,
    status: "scheduled",
  });
  const duePayments = result.plannedPayments;

  if (duePayments.length === 0) {
    return { processed: 0, errors: 0 };
  }

  let processed = 0;
  let errors = 0;

  // Process each due payment
  for (const payment of duePayments) {
    try {
      // Mark as paid (this creates the transaction)
      await markPlannedPaymentAsPaid(payment.id);
      processed++;
      logger.info(`Processed planned payment ${payment.id} (date: ${payment.date})`);
    } catch (error) {
      errors++;
      logger.error(`Error processing planned payment ${payment.id}:`, error);
      // Continue processing other payments even if one fails
    }
  }

  logger.info(`Processed ${processed} planned payments, ${errors} errors`);

  return { processed, errors };
}

/**
 * Process a single planned payment by ID
 * Useful for manual processing or retry logic
 */
export async function processPlannedPayment(
  plannedPaymentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await markPlannedPaymentAsPaid(plannedPaymentId);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error(`Error processing planned payment ${plannedPaymentId}:`, error);
    return { success: false, error: errorMessage };
  }
}

