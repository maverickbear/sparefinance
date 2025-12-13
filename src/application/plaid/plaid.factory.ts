/**
 * Plaid Factory
 * Dependency injection factory for PlaidService and PlaidWebhookService
 */

import { PlaidService } from './plaid.service';
import { PlaidWebhookService } from './plaid-webhook.service';
import { PlaidItemsRepository } from '@/src/infrastructure/database/repositories/plaid-items.repository';
import { AccountsRepository } from '@/src/infrastructure/database/repositories/accounts.repository';
import { TransactionsRepository } from '@/src/infrastructure/database/repositories/transactions.repository';
import { WebhookEventsRepository } from '@/src/infrastructure/database/repositories/webhook-events.repository';

/**
 * Create a PlaidService instance with all dependencies
 */
export function makePlaidService(): PlaidService {
  const plaidItemsRepository = new PlaidItemsRepository();
  const accountsRepository = new AccountsRepository();
  const transactionsRepository = new TransactionsRepository();
  return new PlaidService(plaidItemsRepository, accountsRepository, transactionsRepository);
}

/**
 * Create a PlaidWebhookService instance with all dependencies
 */
export function makePlaidWebhookService(): PlaidWebhookService {
  const webhookEventsRepository = new WebhookEventsRepository();
  const plaidItemsRepository = new PlaidItemsRepository();
  const plaidService = makePlaidService();
  return new PlaidWebhookService(webhookEventsRepository, plaidItemsRepository, plaidService);
}
