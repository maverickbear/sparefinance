/**
 * Domain types for Plaid integration
 * Pure TypeScript types with no external dependencies
 */

/**
 * Plaid transaction metadata stored in plaidMetadata JSONB field
 */
export interface PlaidTransactionMetadata {
  category?: string[] | null;
  categoryId?: string | null;
  transactionType?: string | null;
  transactionCode?: string | null;
  pending?: boolean | null;
  authorizedDate?: string | null;
  authorizedDatetime?: string | null;
  datetime?: string | null;
  isoCurrencyCode?: string | null;
  unofficialCurrencyCode?: string | null;
  merchantName?: string | null;
  merchantEntityId?: string | null;
  logoUrl?: string | null;
  website?: string | null;
  personalFinanceCategory?: {
    primary?: string | null;
    detailed?: string | null;
    confidenceLevel?: string | null;
  } | null;
  personalFinanceCategoryIconUrl?: string | null;
  location?: {
    address?: string | null;
    city?: string | null;
    region?: string | null;
    postalCode?: string | null;
    country?: string | null;
    lat?: number | null;
    lon?: number | null;
    storeNumber?: string | null;
  } | null;
  counterparties?: Array<{
    name?: string | null;
    type?: string | null;
    logoUrl?: string | null;
    website?: string | null;
    entityId?: string | null;
    confidenceLevel?: string | null;
  }> | null;
  paymentChannel?: string | null;
  paymentMeta?: {
    byOrderOf?: string | null;
    payee?: string | null;
    payer?: string | null;
    paymentMethod?: string | null;
    paymentProcessor?: string | null;
    ppdId?: string | null;
    reason?: string | null;
    referenceNumber?: string | null;
  } | null;
  accountOwner?: string | null;
  pendingTransactionId?: string | null;
  checkNumber?: string | null;
}

/**
 * Plaid liability information
 */
export interface PlaidLiability {
  id: string;
  accountId: string;
  liabilityType: 'credit_card' | 'student_loan' | 'mortgage' | 'auto_loan' | 'personal_loan' | 'business_loan' | 'other';
  apr?: number | null;
  interestRate?: number | null;
  minimumPayment?: number | null;
  lastPaymentAmount?: number | null;
  lastPaymentDate?: string | null;
  nextPaymentDueDate?: string | null;
  lastStatementBalance?: number | null;
  lastStatementDate?: string | null;
  creditLimit?: number | null;
  currentBalance?: number | null;
  availableCredit?: number | null;
  plaidAccountId?: string | null;
  plaidItemId?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Plaid connection information
 */
export interface PlaidConnection {
  id: string;
  userId: string;
  itemId: string;
  accessToken: string;
  institutionId?: string | null;
  institutionName?: string | null;
  transactionsCursor?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Plaid institution information
 */
export interface PlaidInstitution {
  institution_id: string;
  name: string;
  products: string[];
  country_codes: string[];
  url?: string;
  primary_color?: string;
  logo?: string;
  routing_numbers?: string[];
  oauth?: boolean;
}

/**
 * Sync result for transactions
 */
export interface PlaidSyncResult {
  synced: number;
  skipped: number;
  errors: number;
  totalProcessed?: number;
}

