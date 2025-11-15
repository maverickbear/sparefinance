"use server";

import { plaidClient } from './index';
import { createServerClient } from '@/lib/supabase-server';
import { formatTimestamp } from '@/lib/utils/timestamp';
import type { PlaidLiability } from './types';

/**
 * Sync liabilities from Plaid for a specific account/item
 */
export async function syncAccountLiabilities(
  itemId: string,
  accessToken: string
): Promise<{
  synced: number;
  updated: number;
  errors: number;
}> {
  const supabase = await createServerClient();
  let synced = 0;
  let updated = 0;
  let errors = 0;

  try {
    // Get liabilities from Plaid
    const liabilitiesResponse = await plaidClient.liabilitiesGet({
      access_token: accessToken,
    });

    const liabilities = liabilitiesResponse.data.liabilities;
    const accounts = liabilitiesResponse.data.accounts;

    // Process credit card liabilities
    if (liabilities.credit && liabilities.credit.length > 0) {
      for (const creditCard of liabilities.credit) {
        try {
          // Find the account in our database
          const { data: account } = await supabase
            .from('Account')
            .select('id')
            .eq('plaidAccountId', creditCard.account_id)
            .single();

          if (!account) {
            console.warn(`Account not found for Plaid account ID: ${creditCard.account_id}`);
            continue;
          }

          // Get account details for credit limit
          const plaidAccount = accounts.find((acc: any) => acc.account_id === creditCard.account_id);
          const creditLimit = plaidAccount?.balances?.limit || null;
          const currentBalance = plaidAccount?.balances?.current || null;
          const availableCredit = creditLimit && currentBalance 
            ? creditLimit - Math.abs(currentBalance) 
            : null;

          // Calculate APR (use first APR if available)
          const apr = creditCard.aprs && creditCard.aprs.length > 0
            ? creditCard.aprs[0].apr_percentage || null
            : null;

          // Check if liability already exists
          const { data: existingLiability } = await supabase
            .from('PlaidLiability')
            .select('id')
            .eq('accountId', account.id)
            .eq('liabilityType', 'credit_card')
            .single();

          const creditCardAny = creditCard as any;
          const liabilityData: Partial<PlaidLiability> = {
            accountId: account.id,
            liabilityType: 'credit_card',
            apr: apr,
            minimumPayment: creditCard.minimum_payment_amount || null,
            lastPaymentAmount: creditCard.last_payment_amount || null,
            lastPaymentDate: creditCard.last_payment_date || null,
            nextPaymentDueDate: creditCard.next_payment_due_date || null,
            lastStatementBalance: creditCard.last_statement_balance || null,
            lastStatementDate: creditCardAny.last_statement_date || null,
            creditLimit: creditLimit,
            currentBalance: currentBalance ? Math.abs(currentBalance) : null,
            availableCredit: availableCredit,
            plaidAccountId: creditCard.account_id,
            plaidItemId: itemId,
            updatedAt: formatTimestamp(new Date()),
          };

          if (existingLiability) {
            // Update existing liability
            const { error: updateError } = await supabase
              .from('PlaidLiability')
              .update(liabilityData)
              .eq('id', existingLiability.id);

            if (updateError) {
              console.error('Error updating Plaid liability:', updateError);
              errors++;
            } else {
              updated++;
            }
          } else {
            // Create new liability
            const liabilityId = crypto.randomUUID();
            const { error: insertError } = await supabase
              .from('PlaidLiability')
              .insert({
                id: liabilityId,
                ...liabilityData,
                createdAt: formatTimestamp(new Date()),
              });

            if (insertError) {
              console.error('Error creating Plaid liability:', insertError);
              errors++;
            } else {
              synced++;
            }
          }

          // Update account credit limit if available
          if (creditLimit) {
            await supabase
              .from('Account')
              .update({ creditLimit: creditLimit })
              .eq('id', account.id);
          }
        } catch (error) {
          console.error('Error processing credit card liability:', error);
          errors++;
        }
      }
    }

    // Process student loan liabilities
    if (liabilities.student && liabilities.student.length > 0) {
      for (const studentLoan of liabilities.student) {
        try {
          // Find the account in our database
          const { data: account } = await supabase
            .from('Account')
            .select('id')
            .eq('plaidAccountId', studentLoan.account_id)
            .single();

          if (!account) {
            console.warn(`Account not found for Plaid account ID: ${studentLoan.account_id}`);
            continue;
          }

          // Check if liability already exists
          const { data: existingLiability } = await supabase
            .from('PlaidLiability')
            .select('id')
            .eq('accountId', account.id)
            .eq('liabilityType', 'student_loan')
            .single();

          const liabilityData: Partial<PlaidLiability> = {
            accountId: account.id,
            liabilityType: 'student_loan',
            interestRate: studentLoan.interest_rate_percentage || null,
            minimumPayment: studentLoan.minimum_payment_amount || null,
            lastPaymentAmount: studentLoan.last_payment_amount || null,
            lastPaymentDate: studentLoan.last_payment_date || null,
            nextPaymentDueDate: studentLoan.next_payment_due_date || null,
            plaidAccountId: studentLoan.account_id,
            plaidItemId: itemId,
            updatedAt: formatTimestamp(new Date()),
          };

          if (existingLiability) {
            const { error: updateError } = await supabase
              .from('PlaidLiability')
              .update(liabilityData)
              .eq('id', existingLiability.id);

            if (updateError) {
              console.error('Error updating student loan liability:', updateError);
              errors++;
            } else {
              updated++;
            }
          } else {
            const liabilityId = crypto.randomUUID();
            const { error: insertError } = await supabase
              .from('PlaidLiability')
              .insert({
                id: liabilityId,
                ...liabilityData,
                createdAt: formatTimestamp(new Date()),
              });

            if (insertError) {
              console.error('Error creating student loan liability:', insertError);
              errors++;
            } else {
              synced++;
            }
          }
        } catch (error) {
          console.error('Error processing student loan liability:', error);
          errors++;
        }
      }
    }

    // Process mortgage liabilities
    if (liabilities.mortgage && liabilities.mortgage.length > 0) {
      for (const mortgage of liabilities.mortgage) {
        try {
          // Find the account in our database
          const { data: account } = await supabase
            .from('Account')
            .select('id')
            .eq('plaidAccountId', mortgage.account_id)
            .single();

          if (!account) {
            console.warn(`Account not found for Plaid account ID: ${mortgage.account_id}`);
            continue;
          }

          // Check if liability already exists
          const { data: existingLiability } = await supabase
            .from('PlaidLiability')
            .select('id')
            .eq('accountId', account.id)
            .eq('liabilityType', 'mortgage')
            .single();

          const interestRate = mortgage.interest_rate?.percentage || null;

          const liabilityData: Partial<PlaidLiability> = {
            accountId: account.id,
            liabilityType: 'mortgage',
            interestRate: interestRate,
            minimumPayment: mortgage.next_monthly_payment || null,
            lastPaymentAmount: mortgage.last_payment_amount || null,
            lastPaymentDate: mortgage.last_payment_date || null,
            nextPaymentDueDate: mortgage.next_payment_due_date || null,
            plaidAccountId: mortgage.account_id,
            plaidItemId: itemId,
            updatedAt: formatTimestamp(new Date()),
          };

          if (existingLiability) {
            const { error: updateError } = await supabase
              .from('PlaidLiability')
              .update(liabilityData)
              .eq('id', existingLiability.id);

            if (updateError) {
              console.error('Error updating mortgage liability:', updateError);
              errors++;
            } else {
              updated++;
            }
          } else {
            const liabilityId = crypto.randomUUID();
            const { error: insertError } = await supabase
              .from('PlaidLiability')
              .insert({
                id: liabilityId,
                ...liabilityData,
                createdAt: formatTimestamp(new Date()),
              });

            if (insertError) {
              console.error('Error creating mortgage liability:', insertError);
              errors++;
            } else {
              synced++;
            }
          }
        } catch (error) {
          console.error('Error processing mortgage liability:', error);
          errors++;
        }
      }
    }

    return { synced, updated, errors };
  } catch (error: any) {
    console.error('Error syncing liabilities:', error);
    throw new Error(error.message || 'Failed to sync liabilities');
  }
}

/**
 * Get all liabilities for a user (including shared accounts via AccountOwner)
 */
export async function getUserLiabilities(userId: string): Promise<PlaidLiability[]> {
  try {
    if (!userId) {
      console.warn('getUserLiabilities: userId is null or undefined');
      return [];
    }

    const supabase = await createServerClient();

    // Get all account IDs the user has access to:
    // 1. Accounts where userId matches directly
    // 2. Accounts shared via AccountOwner table
    
    // First, get accounts where userId matches directly
    const { data: directAccounts, error: directAccountsError } = await supabase
      .from('Account')
      .select('id')
      .eq('userId', userId);

    if (directAccountsError) {
      console.error('Error fetching direct accounts for liabilities:', directAccountsError);
    }

    // Get accounts shared via AccountOwner
    const { data: sharedAccounts, error: sharedAccountsError } = await supabase
      .from('AccountOwner')
      .select('accountId')
      .eq('ownerId', userId);

    if (sharedAccountsError) {
      console.error('Error fetching shared accounts for liabilities:', sharedAccountsError);
    }

    // Combine all account IDs
    const directAccountIds = (directAccounts || []).map((acc) => acc.id);
    const sharedAccountIds = (sharedAccounts || []).map((ao) => ao.accountId);
    const allAccountIds = [...new Set([...directAccountIds, ...sharedAccountIds])];

    if (allAccountIds.length === 0) {
      // No accounts found, return empty array (not an error)
      return [];
    }

    // Get liabilities for these accounts
    const { data: liabilities, error } = await supabase
      .from('PlaidLiability')
      .select('*')
      .in('accountId', allAccountIds)
      .order('nextPaymentDueDate', { ascending: true, nullsFirst: false });

    if (error) {
      console.error('Error fetching liabilities:', {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      return [];
    }

    return (liabilities || []) as PlaidLiability[];
  } catch (error: any) {
    console.error('Error in getUserLiabilities:', {
      message: error?.message,
      stack: error?.stack,
      userId,
    });
    return [];
  }
}

