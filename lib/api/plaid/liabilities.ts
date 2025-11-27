"use server";

import { plaidClient } from './index';
import { createServerClient } from '@/lib/supabase-server';
import { formatTimestamp, formatDateOnly, parseDateWithoutTimezone } from '@/lib/utils/timestamp';
import type { PlaidLiability } from './types';
import { getActiveCreditCardDebt } from '@/lib/utils/credit-card-debt';
import { createDebt } from '@/lib/api/debts';
import { calculateNextDueDate } from '@/lib/utils/credit-card-debt';

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

          // Get account details first (before updating)
          const { data: accountDetails } = await supabase
            .from('Account')
            .select('name, dueDayOfMonth')
            .eq('id', account.id)
            .single();

          // Update account credit limit and dueDayOfMonth if available
          const accountUpdateData: any = {};
          if (creditLimit) {
            accountUpdateData.creditLimit = creditLimit;
          }
          
          // Extract dueDayOfMonth from nextPaymentDueDate if available
          let extractedDueDayOfMonth: number | null = null;
          if (creditCard.next_payment_due_date) {
            try {
              const dueDate = parseDateWithoutTimezone(creditCard.next_payment_due_date);
              const dayOfMonth = dueDate.getDate();
              if (dayOfMonth >= 1 && dayOfMonth <= 31) {
                extractedDueDayOfMonth = dayOfMonth;
                accountUpdateData.dueDayOfMonth = dayOfMonth;
              }
            } catch (error) {
              console.warn('Error extracting dueDayOfMonth from nextPaymentDueDate:', error);
            }
          }
          
          if (Object.keys(accountUpdateData).length > 0) {
            accountUpdateData.updatedAt = formatTimestamp(new Date());
            await supabase
              .from('Account')
              .update(accountUpdateData)
              .eq('id', account.id);
          }

          // Use extracted dueDayOfMonth or existing one from account
          const dueDayOfMonth = extractedDueDayOfMonth ?? accountDetails?.dueDayOfMonth ?? null;

          // Create or update Debt record if balance is not zero
          if (currentBalance && Math.abs(currentBalance) > 0) {
            try {
              const balanceAmount = Math.abs(currentBalance);
              const activeDebt = await getActiveCreditCardDebt(account.id);
              
              if (!activeDebt) {
                // Create new debt if it doesn't exist
                const nextDueDate = dueDayOfMonth 
                  ? calculateNextDueDate(dueDayOfMonth)
                  : creditCard.next_payment_due_date 
                    ? parseDateWithoutTimezone(creditCard.next_payment_due_date)
                    : new Date();
                
                await createDebt({
                  name: `${accountDetails?.name || 'Credit Card'} – Current Bill`,
                  loanType: "credit_card",
                  initialAmount: balanceAmount,
                  downPayment: 0,
                  interestRate: apr || 0,
                  totalMonths: null,
                  firstPaymentDate: formatDateOnly(nextDueDate),
                  monthlyPayment: creditCard.minimum_payment_amount || 0, // Credit cards: minimum payment (informational only - user can pay any amount)
                  accountId: account.id,
                  priority: "Medium",
                  status: "active",
                  nextDueDate: creditCard.next_payment_due_date 
                    ? parseDateWithoutTimezone(creditCard.next_payment_due_date)
                    : nextDueDate,
                });
                
                console.log(`[PLAID LIABILITIES] Created debt for credit card account ${account.id} with balance ${balanceAmount}`);
              } else {
                // Update existing debt if balance changed
                const balanceChanged = Math.abs(activeDebt.currentBalance - balanceAmount) > 0.01;
                
                if (balanceChanged) {
                  const updateData: any = {
                    currentBalance: balanceAmount,
                    updatedAt: formatTimestamp(new Date()),
                  };
                  
                  // Update nextDueDate if available from Plaid
                  if (creditCard.next_payment_due_date) {
                    updateData.nextDueDate = formatDateOnly(parseDateWithoutTimezone(creditCard.next_payment_due_date));
                  }
                  
                  // Update minimum payment if available
                  if (creditCard.minimum_payment_amount) {
                    updateData.monthlyPayment = creditCard.minimum_payment_amount;
                  }
                  
                  // Update APR if available
                  if (apr !== null) {
                    updateData.interestRate = apr;
                  }
                  
                  // Mark as paid off if balance is zero
                  if (balanceAmount <= 0) {
                    updateData.isPaidOff = true;
                    updateData.status = "closed";
                    updateData.paidOffAt = formatTimestamp(new Date());
                  } else if (activeDebt.isPaidOff) {
                    // Reopen debt if it was paid off but now has balance
                    updateData.isPaidOff = false;
                    updateData.status = "active";
                    updateData.paidOffAt = null;
                  }
                  
                  await supabase
                    .from('Debt')
                    .update(updateData)
                    .eq('id', activeDebt.id);
                  
                  console.log(`[PLAID LIABILITIES] Updated debt ${activeDebt.id} for credit card account ${account.id} with new balance ${balanceAmount}`);
                }
              }
            } catch (error) {
              console.error('Error creating/updating debt for credit card:', error);
              // Don't increment errors count as this is not critical for liability sync
            }
          } else if (currentBalance && Math.abs(currentBalance) <= 0) {
            // Balance is zero - close any active debt
            try {
              const activeDebt = await getActiveCreditCardDebt(account.id);
              if (activeDebt && !activeDebt.isPaidOff) {
                await supabase
                  .from('Debt')
                  .update({
                    currentBalance: 0,
                    isPaidOff: true,
                    status: "closed",
                    paidOffAt: formatTimestamp(new Date()),
                    updatedAt: formatTimestamp(new Date()),
                  })
                  .eq('id', activeDebt.id);
                
                console.log(`[PLAID LIABILITIES] Closed debt ${activeDebt.id} for credit card account ${account.id} (balance is zero)`);
              }
            } catch (error) {
              console.error('Error closing debt for credit card:', error);
            }
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
    
    // Check if it's a product authorization error
    const errorCode = error.response?.data?.error_code;
    const errorType = error.response?.data?.error_type;
    
    if (errorCode === 'INVALID_PRODUCT' || errorType === 'INVALID_INPUT') {
      console.warn('[PLAID LIABILITIES] Liabilities product not authorized for this client. Skipping liability sync.');
      // Return empty result instead of throwing - this is not a critical error
      return { synced: 0, updated: 0, errors: 0 };
    }
    
    throw new Error(error.message || 'Failed to sync liabilities');
  }
}

/**
 * Get all liabilities for a user (including shared accounts via AccountOwner)
 * OPTIMIZED: Uses getAccounts() which properly handles RLS policies
 */
export async function getUserLiabilities(userId: string, accessToken?: string, refreshToken?: string): Promise<PlaidLiability[]> {
  try {
    if (!userId) {
      console.warn('getUserLiabilities: userId is null or undefined');
      return [];
    }

    // OPTIMIZED: Use getAccounts() which properly handles RLS and AccountOwner relationships
    // This avoids permission errors when accessing Account and AccountOwner tables directly
    const { getAccounts } = await import('@/lib/api/accounts');
    const accounts = await getAccounts(accessToken, refreshToken);

    if (!accounts || accounts.length === 0) {
      // No accounts found, return empty array (not an error)
      return [];
    }

    // Extract all account IDs (getAccounts already includes shared accounts via AccountOwner)
    const allAccountIds = accounts.map(acc => acc.id);

    const supabase = await createServerClient(accessToken, refreshToken);

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

