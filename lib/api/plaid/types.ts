/**
 * TypeScript types for Plaid API responses and metadata
 */

/**
 * Plaid transaction metadata stored in plaidMetadata JSONB field
 * All fields use camelCase to match project conventions
 * 
 * Note: For backward compatibility, code should support both camelCase and snake_case
 * when reading existing data, but new data should always be saved in camelCase
 */
export interface PlaidTransactionMetadata {
  // Categories
  category?: string[] | null;
  categoryId?: string | null;
  
  // Transaction type and codes
  transactionType?: string | null; // "place", "digital", "special", "unresolved"
  transactionCode?: string | null; // European institutions only
  
  // Status and dates
  pending?: boolean | null;
  authorizedDate?: string | null;
  authorizedDatetime?: string | null;
  datetime?: string | null;
  
  // Currency
  isoCurrencyCode?: string | null;
  unofficialCurrencyCode?: string | null;
  
  // Merchant information
  merchantName?: string | null;
  merchantEntityId?: string | null;
  logoUrl?: string | null;
  website?: string | null;
  
  // Personal finance category (Plaid's AI categorization)
  personalFinanceCategory?: {
    primary?: string | null;
    detailed?: string | null;
    confidenceLevel?: string | null;
  } | null;
  personalFinanceCategoryIconUrl?: string | null;
  
  // Location
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
  
  // Counterparties (merchants, marketplaces, etc.)
  counterparties?: Array<{
    name?: string | null;
    type?: string | null;
    logoUrl?: string | null;
    website?: string | null;
    entityId?: string | null;
    confidenceLevel?: string | null;
  }> | null;
  
  // Payment information
  paymentChannel?: string | null; // "in store", "online", "other"
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
  
  // Account and transaction relationships
  accountOwner?: string | null;
  pendingTransactionId?: string | null;
  checkNumber?: string | null;
  
  // Backward compatibility: support old snake_case fields when reading
  // These should not be used when writing new data
  category_id?: string | null; // @deprecated - use categoryId
  authorized_date?: string | null; // @deprecated - use authorizedDate
  authorized_datetime?: string | null; // @deprecated - use authorizedDatetime
  iso_currency_code?: string | null; // @deprecated - use isoCurrencyCode
  unofficial_currency_code?: string | null; // @deprecated - use unofficialCurrencyCode
  transaction_code?: string | null; // @deprecated - use transactionCode
  account_owner?: string | null; // @deprecated - use accountOwner
  pending_transaction_id?: string | null; // @deprecated - use pendingTransactionId
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
 * Plaid credit card liability details
 */
export interface PlaidCreditCardLiability {
  account_id: string;
  aprs?: Array<{
    apr_percentage?: number | null;
    apr_type?: string | null;
    balance_subject_to_apr?: number | null;
    interest_charge_amount?: number | null;
  }> | null;
  is_overdue?: boolean | null;
  last_payment_amount?: number | null;
  last_payment_date?: string | null;
  last_statement_balance?: number | null;
  last_statement_date?: string | null;
  minimum_payment_amount?: number | null;
  next_payment_due_date?: string | null;
}

/**
 * Plaid student loan liability details
 */
export interface PlaidStudentLoanLiability {
  account_id: string;
  account_number?: string | null;
  disbursement_dates?: string[] | null;
  expected_payoff_date?: string | null;
  guarantor?: string | null;
  interest_rate_percentage?: number | null;
  is_overdue?: boolean | null;
  last_payment_amount?: number | null;
  last_payment_date?: string | null;
  loan_status?: {
    end_date?: string | null;
    type?: string | null;
  } | null;
  loan_name?: string | null;
  minimum_payment_amount?: number | null;
  next_payment_due_date?: string | null;
  origination_date?: string | null;
  origination_principal_amount?: number | null;
  outstanding_interest_amount?: number | null;
  payment_reference_number?: string | null;
  pslf_status?: {
    estimated_eligibility_date?: string | null;
    payments_made?: number | null;
    payments_remaining?: number | null;
  } | null;
  repayment_plan?: {
    description?: string | null;
    type?: string | null;
  } | null;
  sequence_number?: string | null;
  servicer_address?: {
    city?: string | null;
    country?: string | null;
    postal_code?: string | null;
    region?: string | null;
    street?: string | null;
  } | null;
  ytd_interest_paid?: number | null;
  ytd_principal_paid?: number | null;
}

/**
 * Plaid mortgage liability details
 */
export interface PlaidMortgageLiability {
  account_id: string;
  account_number?: string | null;
  current_late_fee?: number | null;
  escrow_balance?: number | null;
  has_pmi?: boolean | null;
  has_prepayment_penalty?: boolean | null;
  interest_rate?: {
    percentage?: number | null;
    type?: string | null;
  } | null;
  last_payment_amount?: number | null;
  last_payment_date?: string | null;
  loan_type_description?: string | null;
  loan_term?: string | null;
  maturity_date?: string | null;
  next_monthly_payment?: number | null;
  next_payment_due_date?: string | null;
  origination_date?: string | null;
  origination_principal_amount?: number | null;
  past_due_amount?: number | null;
  property_address?: {
    city?: string | null;
    country?: string | null;
    postal_code?: string | null;
    region?: string | null;
    street?: string | null;
  } | null;
  ytd_interest_paid?: number | null;
  ytd_principal_paid?: number | null;
}

