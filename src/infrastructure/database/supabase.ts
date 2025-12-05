import { createServerClient } from "./supabase-server";

// Database types for Supabase tables
// Based on schema_reference.sql - all tables and columns from the schema
// Updated after migration 20241201000000_fix_database_issues.sql
export interface Database {
  Account: {
    id: string;
    name: string;
    type: 'cash' | 'checking' | 'savings' | 'credit' | 'investment' | 'other';
    createdAt: string;
    updatedAt: string;
    creditLimit: number | null;
    userId: string | null;
    initialBalance: number | null;
    plaidItemId: string | null;
    plaidAccountId: string | null;
    isConnected: boolean | null;
    lastSyncedAt: string | null;
    syncEnabled: boolean | null;
    plaidMask: string | null;
    plaidOfficialName: string | null;
    plaidVerificationStatus: string | null;
    plaidSubtype: string | null;
    currencyCode: string | null;
    plaidUnofficialCurrencyCode: string | null;
    plaidAvailableBalance: number | null;
    plaidPersistentAccountId: string | null;
    plaidHolderCategory: string | null;
    plaidVerificationName: string | null;
    dueDayOfMonth: number | null;
    extraCredit: number;
  };
  AccountInvestmentValue: {
    id: string;
    accountId: string;
    totalValue: number;
    createdAt: string;
    updatedAt: string;
  };
  AccountOwner: {
    id: string;
    accountId: string;
    ownerId: string;
    createdAt: string;
    updatedAt: string;
  };
  Budget: {
    id: string;
    period: string;
    categoryId: string | null;
    amount: number;
    note: string | null;
    createdAt: string;
    updatedAt: string;
    groupId: string | null;
    userId: string; // NOT NULL após migração 20241201000000_fix_database_issues.sql
    subcategoryId: string | null;
    isRecurring: boolean;
  };
  BudgetCategory: {
    id: string;
    budgetId: string;
    categoryId: string;
    createdAt: string;
  };
  Category: {
    id: string;
    name: string;
    groupId: string;
    createdAt: string;
    updatedAt: string;
    userId: string | null;
  };
  Debt: {
    id: string;
    name: string;
    loanType: string;
    initialAmount: number;
    downPayment: number;
    currentBalance: number;
    interestRate: number;
    totalMonths: number;
    firstPaymentDate: string;
    monthlyPayment: number;
    principalPaid: number;
    interestPaid: number;
    additionalContributions: boolean;
    additionalContributionAmount: number | null;
    priority: string;
    description: string | null;
    isPaidOff: boolean;
    isPaused: boolean;
    paidOffAt: string | null;
    createdAt: string;
    updatedAt: string;
    paymentFrequency: string;
    paymentAmount: number | null;
    accountId: string | null;
    userId: string; // NOT NULL após migração 20241201000000_fix_database_issues.sql
    status: string;
    nextDueDate: string | null;
  };
  Goal: {
    id: string;
    name: string;
    targetAmount: number;
    incomePercentage: number;
    isCompleted: boolean;
    completedAt: string | null;
    description: string | null;
    createdAt: string;
    updatedAt: string;
    currentBalance: number;
    priority: string;
    isPaused: boolean;
    expectedIncome: number | null;
    targetMonths: number | null;
    userId: string; // NOT NULL após migração 20241201000000_fix_database_issues.sql
  };
  HouseholdMember: {
    id: string;
    ownerId: string;
    memberId: string | null;
    email: string;
    name: string | null;
    status: string;
    invitationToken: string;
    invitedAt: string;
    acceptedAt: string | null;
    createdAt: string;
    updatedAt: string;
    role: string;
  };
  InvestmentAccount: {
    id: string;
    name: string;
    type: string;
    accountId: string | null;
    createdAt: string;
    updatedAt: string;
    userId: string; // NOT NULL após migração 20241201000000_fix_database_issues.sql
  };
  InvestmentTransaction: {
    id: string;
    date: string;
    accountId: string;
    securityId: string | null;
    type: string;
    quantity: number | null;
    price: number | null;
    fees: number;
    notes: string | null;
    transferToId: string | null;
    transferFromId: string | null;
    plaidInvestmentTransactionId: string | null;
    plaidSubtype: string | null;
    currencyCode: string | null;
    createdAt: string;
    updatedAt: string;
  };
  Group: {
    id: string;
    name: string;
    type: "income" | "expense" | null;
    createdAt: string;
    updatedAt: string;
    userId: string | null;
  };
  Plan: {
    id: string;
    name: string;
    priceMonthly: number;
    priceYearly: number;
    features: Record<string, unknown>;
    stripePriceIdMonthly: string | null;
    stripePriceIdYearly: string | null;
    stripeProductId: string | null;
    createdAt: string;
    updatedAt: string;
  };
  Security: {
    id: string;
    symbol: string;
    name: string;
    class: string;
    sector: string | null;
    closePrice: number | null;
    closePriceAsOf: string | null;
    currencyCode: string | null;
    createdAt: string;
    updatedAt: string;
  };
  SecurityPrice: {
    id: string;
    securityId: string;
    date: string;
    price: number;
    createdAt: string;
  };
  SimpleInvestmentEntry: {
    id: string;
    accountId: string;
    date: string;
    type: string;
    amount: number;
    description: string | null;
    createdAt: string;
    updatedAt: string;
  };
  Subcategory: {
    id: string;
    name: string;
    categoryId: string;
    createdAt: string;
    updatedAt: string;
    userId: string | null;
    logo: string | null;
  };
  Subscription: {
    id: string;
    userId: string;
    planId: string;
    status: string;
    stripeSubscriptionId: string | null;
    stripeCustomerId: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    trialStartDate: string | null;
    trialEndDate: string | null;
    cancelAtPeriodEnd: boolean;
    createdAt: string;
    updatedAt: string;
  };
  Transaction: {
    id: string;
    date: string;
    type: string;
    amount: number;
    accountId: string;
    categoryId: string | null;
    subcategoryId: string | null;
    description: string | null;
    tags: string;
    transferToId: string | null;
    transferFromId: string | null;
    createdAt: string;
    updatedAt: string;
    isRecurring: boolean;
    expenseType: string | null;
    suggestedCategoryId: string | null;
    suggestedSubcategoryId: string | null;
    plaidMetadata: Record<string, unknown> | null;
  };
  User: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    createdAt: string;
    updatedAt: string;
    role: string;
    phoneNumber: string | null;
    dateOfBirth: string | null;
  };
  PlaidConnection: {
    id: string;
    userId: string;
    itemId: string;
    accessToken: string;
    institutionId: string | null;
    institutionName: string | null;
    institutionLogo: string | null;
    createdAt: string;
    updatedAt: string;
    errorCode: string | null;
    errorMessage: string | null;
    transactionsCursor: string | null;
  };
  TransactionSync: {
    id: string;
    accountId: string;
    plaidTransactionId: string;
    transactionId: string | null;
    syncDate: string;
    status: string;
  };
  PlaidLiability: {
    id: string;
    accountId: string;
    liabilityType: string;
    apr: number | null;
    interestRate: number | null;
    minimumPayment: number | null;
    lastPaymentAmount: number | null;
    lastPaymentDate: string | null;
    nextPaymentDueDate: string | null;
    lastStatementBalance: number | null;
    lastStatementDate: string | null;
    creditLimit: number | null;
    currentBalance: number | null;
    availableCredit: number | null;
    plaidAccountId: string | null;
    plaidItemId: string | null;
    createdAt: string;
    updatedAt: string;
  };
}

// Helper to get the Supabase client
export function getSupabaseClient() {
  return createServerClient();
}

