/**
 * Domain validations for Plaid integration
 * Zod schemas for validating Plaid data
 */

import { z } from 'zod';
import {
  PLAID_ITEM_STATUS,
  PLAID_ACCOUNT_TYPES,
  PLAID_WEBHOOK_TYPES,
} from './plaid.constants';

/**
 * Plaid Item Status schema
 */
export const plaidItemStatusSchema = z.enum(PLAID_ITEM_STATUS as unknown as [string, ...string[]]);

/**
 * Plaid Account Type schema
 */
export const plaidAccountTypeSchema = z.enum(PLAID_ACCOUNT_TYPES as unknown as [string, ...string[]]);

/**
 * Plaid Item schema
 */
export const plaidItemSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  itemId: z.string().min(1),
  accessTokenEncrypted: z.string().min(1),
  institutionId: z.string().nullable(),
  institutionName: z.string().nullable(),
  status: plaidItemStatusSchema,
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  consentExpiresAt: z.union([z.date(), z.string()]).nullable(),
  lastSuccessfulUpdate: z.union([z.date(), z.string()]).nullable(),
  isSyncing: z.boolean(),
  syncStartedAt: z.union([z.date(), z.string()]).nullable(),
  createdAt: z.union([z.date(), z.string()]),
  updatedAt: z.union([z.date(), z.string()]),
});

/**
 * Plaid Account schema
 */
export const plaidAccountSchema = z.object({
  accountId: z.string().min(1),
  itemId: z.string().min(1),
  name: z.string().min(1),
  officialName: z.string().nullable(),
  type: plaidAccountTypeSchema,
  subtype: z.string().nullable(),
  mask: z.string().nullable(),
  balances: z.object({
    available: z.number().nullable(),
    current: z.number().nullable(),
    limit: z.number().nullable(),
    isoCurrencyCode: z.string().nullable(),
    unofficialCurrencyCode: z.string().nullable(),
  }),
  verificationStatus: z.string().nullable(),
  verificationName: z.string().nullable(),
  persistentAccountId: z.string().nullable(),
  holderCategory: z.enum(['personal', 'business', 'unrecognized']).nullable(),
});

/**
 * Plaid Transaction schema
 */
export const plaidTransactionSchema = z.object({
  transactionId: z.string().min(1),
  accountId: z.string().min(1),
  amount: z.number(),
  date: z.union([z.date(), z.string()]),
  authorizedDate: z.union([z.date(), z.string()]).nullable(),
  name: z.string().min(1),
  merchantName: z.string().nullable(),
  category: z.array(z.string()).nullable(),
  categoryId: z.string().nullable(),
  primaryCategory: z.string().nullable(),
  detailedCategory: z.string().nullable(),
  isoCurrencyCode: z.string().nullable(),
  unofficialCurrencyCode: z.string().nullable(),
  paymentChannel: z.string(),
  pending: z.boolean(),
  accountOwner: z.string().nullable(),
});

/**
 * Link Token Request schema
 */
export const linkTokenRequestSchema = z.object({
  userId: z.string().uuid(),
  clientName: z.string().optional(),
  language: z.string().optional(),
  countryCodes: z.array(z.string()).optional(),
  products: z.array(z.string()).optional(),
});

/**
 * Exchange Public Token Request schema
 */
export const exchangePublicTokenRequestSchema = z.object({
  publicToken: z.string().min(1),
  userId: z.string().uuid(),
});

/**
 * Plaid Webhook Event schema
 */
export const plaidWebhookEventSchema = z.object({
  webhookType: z.enum(PLAID_WEBHOOK_TYPES as unknown as [string, ...string[]]),
  webhookCode: z.string(),
  itemId: z.string().min(1),
  environment: z.string(),
  newTransactions: z.number().optional(),
  removedTransactions: z.array(z.string()).optional(),
  accountIds: z.array(z.string()).optional(),
  error: z.object({
    errorType: z.string(),
    errorCode: z.string(),
    errorMessage: z.string(),
  }).optional(),
});

/**
 * Plaid Error schema
 */
export const plaidErrorSchema = z.object({
  errorType: z.string(),
  errorCode: z.string(),
  errorMessage: z.string(),
  displayMessage: z.string().nullable(),
  requestId: z.string().nullable(),
});
