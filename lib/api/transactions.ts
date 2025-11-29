"use server";

import { unstable_cache, revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { TransactionFormData } from "@/src/domain/transactions/transactions.validations";
import { formatTimestamp, formatDateStart, formatDateEnd, formatDateOnly, getCurrentTimestamp, parseDateInput } from "@/src/infrastructure/utils/timestamp";
import { getDebts } from "@/lib/api/debts";
import { calculateNextPaymentDates, type DebtForCalculation } from "@/lib/utils/debts";
import { getDebtCategoryMapping } from "@/lib/utils/debt-categories";
import { getPlannedPayments, PLANNED_HORIZON_DAYS, generatePlannedPaymentsFromRecurringTransaction } from "@/lib/api/planned-payments";
import { guardTransactionLimit, getCurrentUserId, throwIfNotAllowed } from "@/src/application/shared/feature-guard";
import { requireTransactionOwnership } from "@/src/infrastructure/utils/security";
import { suggestCategory, updateCategoryLearning } from "@/src/application/shared/category-learning";
import { logger } from "@/src/infrastructure/utils/logger";
import { encryptDescription, decryptDescription, decryptAmount, normalizeDescription, getTransactionAmount } from "@/src/infrastructure/utils/transaction-encryption";
import { getUserSubscriptionData } from "@/lib/api/subscription";
import { 
  getActiveCreditCardDebt, 
  calculateNextDueDate, 
  isCreditCardAccount,
  getCreditCardAccount 
} from "@/lib/utils/credit-card-debt";
import { createDebt } from "@/lib/api/debts";
import { getActiveHouseholdId } from "@/lib/utils/household";

export async function createTransaction(data: TransactionFormData, providedUserId?: string) {
    const supabase = await createServerClient();

  // Get current user and validate transaction limit
  // If userId is provided (for server-side operations like Plaid sync), use it directly
  // Otherwise, get it from the authenticated session
  let userId: string;
  
  if (providedUserId) {
    // Server-side operation (e.g., Plaid sync, background jobs)
    // Validate that the account belongs to this user for security
    // Note: In service role context, RLS is bypassed, so we can query directly
    const { data: account, error: accountError } = await supabase
      .from('Account')
      .select('userId')
      .eq('id', data.accountId)
      .single();
    
    // If account doesn't exist, that's an error
    if (accountError || !account) {
      logger.error('Account not found when creating transaction:', {
        accountId: data.accountId,
        providedUserId,
        error: accountError,
      });
      throw new Error(`Account not found: ${accountError?.message || 'Unknown error'}`);
    }
    
    // If account has a userId, it must match the provided userId
    // If account.userId is null (legacy accounts), allow it in server context
    if (account.userId !== null && account.userId !== providedUserId) {
      logger.error('Account userId mismatch:', {
        accountId: data.accountId,
        accountUserId: account.userId,
        providedUserId,
      });
      throw new Error("Unauthorized: Account does not belong to user");
    }
    
    userId = providedUserId;
  } else {
    // Client-side operation - require authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error("Unauthorized");
    }
    userId = user.id;
  }

  // Check transaction limit before creating (still check here for early validation)
  const limitGuard = await guardTransactionLimit(userId, data.date instanceof Date ? data.date : new Date(data.date));
  await throwIfNotAllowed(limitGuard);

  // Get plan limits for SQL function using unified API
  const { limits } = await getUserSubscriptionData(userId);

  // Ensure date is a Date object
  const date = data.date instanceof Date ? data.date : new Date(data.date);
  const now = formatTimestamp(new Date());
  
  // Format date for PostgreSQL date type (YYYY-MM-DD)
  const transactionDate = formatDateOnly(date);

  // Prepare auxiliary fields
  const encryptedDescription = encryptDescription(data.description || null);
  const descriptionSearch = normalizeDescription(data.description);
  // Amount is no longer encrypted - store directly as numeric

  // Get category suggestion from learning model if no category is provided
  let categorySuggestion = null;
  if (!data.categoryId && data.description) {
    try {
      categorySuggestion = await suggestCategory(
        userId,
        data.description,
        data.amount,
        data.type
      );
      logger.log('Category suggestion for manual transaction:', {
        description: data.description?.substring(0, 50),
        amount: data.amount,
        type: data.type,
        suggestion: categorySuggestion ? {
          categoryId: categorySuggestion.categoryId,
          confidence: categorySuggestion.confidence,
          matchCount: categorySuggestion.matchCount,
        } : null,
      });
    } catch (error) {
      logger.error('Error getting category suggestion:', error);
      // Continue without suggestion if there's an error
    }
  }

  // Generate UUID for transaction
  const id = crypto.randomUUID();

  // Use provided category if available, otherwise null (don't auto-categorize even with high confidence)
  // We'll always show suggestions for user approval/rejection
  // For transfers, don't use categories
  const finalCategoryId = data.type === "transfer" ? null : (data.categoryId || null);
  const finalSubcategoryId = data.type === "transfer" ? null : (data.subcategoryId || null);

  // Get active household ID
  const householdId = await getActiveHouseholdId(userId);

  // For transfers with toAccountId (outgoing), use SQL function for atomic creation
  if (data.type === "transfer" && data.toAccountId) {
    const { data: transferResult, error: transferError } = await supabase.rpc(
      'create_transfer_with_limit',
      {
        p_user_id: userId,
        p_from_account_id: data.accountId,
        p_to_account_id: data.toAccountId,
        p_amount: data.amount,
        p_date: transactionDate,
        p_description: encryptedDescription,
        p_description_search: descriptionSearch,
        p_recurring: data.recurring ?? false,
        p_max_transactions: limits.maxTransactions,
      }
    );

    if (transferError) {
      logger.error("Error creating transfer via SQL function:", transferError);
      throw new Error(`Failed to create transfer transaction: ${transferError.message || JSON.stringify(transferError)}`);
    }

    // Fetch the created outgoing transaction to return
    // transferResult is a jsonb object, so we need to access it correctly
    const result = Array.isArray(transferResult) ? transferResult[0] : transferResult;
    const outgoingId = result?.outgoing_id;
    if (!outgoingId) {
      throw new Error("Failed to get outgoing transaction ID from transfer function");
    }
    
    const { data: outgoingTransaction, error: fetchError } = await supabase
      .from("Transaction")
      .select("*")
      .eq("id", outgoingId)
      .single();

    if (fetchError || !outgoingTransaction) {
      logger.error("Error fetching created transfer transaction:", fetchError);
      throw new Error("Failed to fetch created transfer transaction");
    }

    // Update both transactions with householdId if not set by SQL function
    if (householdId) {
      // Update outgoing transaction
      if (!outgoingTransaction.householdId) {
        const { error: updateOutgoingError } = await supabase
          .from("Transaction")
          .update({ householdId })
          .eq("id", outgoingId);

        if (updateOutgoingError) {
          logger.error("Error updating outgoing transaction with householdId:", updateOutgoingError);
        }
      }

      // Update incoming transaction (get ID from result)
      const incomingId = result?.incoming_id;
      if (incomingId) {
        const { error: updateIncomingError } = await supabase
          .from("Transaction")
          .update({ householdId })
          .eq("id", incomingId);

        if (updateIncomingError) {
          logger.error("Error updating incoming transaction with householdId:", updateIncomingError);
        }
      }
    }

    // Invalidate cache to ensure dashboard shows updated data
    const { invalidateTransactionCaches } = await import('@/lib/services/cache-manager');
    invalidateTransactionCaches();

    // Update category_learning if category was provided (shouldn't happen for transfers, but just in case)
    if (finalCategoryId) {
      await updateCategoryLearning(userId, descriptionSearch, data.type, finalCategoryId, finalSubcategoryId, data.amount);
    }

    // Handle credit card payment via transfer
    try {
      const toAccount = await getCreditCardAccount(data.toAccountId);
      if (toAccount && toAccount.type === "credit") {
        const paymentAmount = data.amount;
        const activeDebt = await getActiveCreditCardDebt(data.toAccountId);

        if (activeDebt) {
          // Debt exists - handle payment scenarios
          const remainingDebt = activeDebt.currentBalance;
          let newBalance = remainingDebt - paymentAmount;
          let newStatus = "active";
          let newExtraCredit = toAccount.extraCredit || 0;

          if (paymentAmount < remainingDebt) {
            // Partial payment
            newBalance = Math.max(0, newBalance);
            newStatus = "active";
          } else if (paymentAmount === remainingDebt) {
            // Exact payment
            newBalance = 0;
            newStatus = "closed";
          } else {
            // Overpayment
            const overPayment = paymentAmount - remainingDebt;
            newBalance = 0;
            newStatus = "closed";
            newExtraCredit = (toAccount.extraCredit || 0) + overPayment;
          }

          // Update debt
          const updateData: Record<string, unknown> = {
            currentBalance: newBalance,
            status: newStatus,
            updatedAt: formatTimestamp(new Date()),
          };

          if (newStatus === "closed") {
            updateData.isPaidOff = true;
            if (!activeDebt.paidOffAt) {
              updateData.paidOffAt = formatTimestamp(new Date());
            }
          }

          await supabase
            .from("Debt")
            .update(updateData)
            .eq("id", activeDebt.id);

          // Update account extraCredit if there was overpayment
          if (newExtraCredit !== (toAccount.extraCredit || 0)) {
            await supabase
              .from("Account")
              .update({ extraCredit: newExtraCredit })
              .eq("id", data.toAccountId);
          }
        } else {
          // No active debt - all payment becomes extraCredit
          const currentExtraCredit = toAccount.extraCredit || 0;
          const newExtraCredit = currentExtraCredit + paymentAmount;

          await supabase
            .from("Account")
            .update({ extraCredit: newExtraCredit })
            .eq("id", data.toAccountId);
        }
      }
    } catch (error) {
      // Log error but don't fail transfer creation
      logger.error("Error handling credit card payment via transfer:", error);
    }

    // Return the outgoing transaction as the main one
    return outgoingTransaction;
  }

  // For transfers with transferFromId (incoming, e.g., credit card payments)
  // Create a single transaction on the destination account with transferFromId set
  if (data.type === "transfer" && data.transferFromId) {
    const { data: transactionResult, error: transactionError } = await supabase.rpc(
      'create_transaction_with_limit',
      {
        p_id: id,
        p_date: transactionDate,
        p_type: 'transfer',
        p_amount: data.amount,
        p_account_id: data.accountId,
        p_user_id: userId,
        p_category_id: null, // Transfers don't have categories
        p_subcategory_id: null,
        p_description: encryptedDescription,
        p_description_search: descriptionSearch,
        p_recurring: data.recurring ?? false,
        p_expense_type: null,
        p_created_at: now,
        p_updated_at: now,
        p_max_transactions: limits.maxTransactions,
      }
    );

    if (transactionError) {
      logger.error("Error creating transfer transaction via SQL function:", transactionError);
      throw new Error(`Failed to create transfer transaction: ${transactionError.message || JSON.stringify(transactionError)}`);
    }

    // Fetch the created transaction
    const { data: transaction, error: fetchError } = await supabase
      .from("Transaction")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !transaction) {
      logger.error("Error fetching created transfer transaction:", fetchError);
      throw new Error("Failed to fetch created transfer transaction");
    }

    // Update transaction with transferFromId
    const { error: updateTransferError } = await supabase
      .from("Transaction")
      .update({ 
        transferFromId: data.transferFromId,
        householdId: householdId || transaction.householdId,
      })
      .eq("id", id);

    if (updateTransferError) {
      logger.error("Error updating transfer with transferFromId:", updateTransferError);
      throw new Error(`Failed to update transfer transaction: ${updateTransferError.message || JSON.stringify(updateTransferError)}`);
    }

    // Handle credit card payment - update debt if this is a credit card account
    try {
      const { data: account } = await supabase
        .from('Account')
        .select('type')
        .eq('id', data.accountId)
        .single();

      if (account?.type === 'credit') {
        const activeDebt = await getActiveCreditCardDebt(data.accountId);
        if (activeDebt) {
          const paymentAmount = data.amount;
          const remainingDebt = activeDebt.currentBalance;
          let newBalance = remainingDebt - paymentAmount;
          let newStatus = "active";
          let newExtraCredit = 0;

          if (paymentAmount < remainingDebt) {
            newBalance = Math.max(0, newBalance);
            newStatus = "active";
          } else if (paymentAmount === remainingDebt) {
            newBalance = 0;
            newStatus = "closed";
          } else {
            const overPayment = paymentAmount - remainingDebt;
            newBalance = 0;
            newStatus = "closed";
            const { data: creditAccount } = await supabase
              .from('Account')
              .select('extraCredit')
              .eq('id', data.accountId)
              .single();
            newExtraCredit = (creditAccount?.extraCredit || 0) + overPayment;
          }

          const updateData: Record<string, unknown> = {
            currentBalance: newBalance,
            status: newStatus,
            updatedAt: formatTimestamp(new Date()),
          };

          if (newStatus === "closed") {
            updateData.isPaidOff = true;
            if (!activeDebt.paidOffAt) {
              updateData.paidOffAt = formatTimestamp(new Date());
            }
          }

          await supabase
            .from("Debt")
            .update(updateData)
            .eq("id", activeDebt.id);

          if (newExtraCredit > 0) {
            await supabase
              .from("Account")
              .update({ extraCredit: newExtraCredit })
              .eq("id", data.accountId);
          }
        }
      }
    } catch (error) {
      logger.error("Error handling credit card payment via transfer:", error);
      // Don't fail transaction creation
    }

    // Invalidate cache
    const { invalidateTransactionCaches } = await import('@/lib/services/cache-manager');
    invalidateTransactionCaches();

    return transaction;
  }

  // Regular transaction (expense, income, or transfer without transferFromId) - use SQL function for atomic creation
  // Note: householdId was already declared above (line 94) and is available here
  const { data: transactionResult, error: transactionError } = await supabase.rpc(
    'create_transaction_with_limit',
    {
      p_id: id,
      p_date: transactionDate,
      p_type: data.type,
      p_amount: data.amount,
      p_account_id: data.accountId,
      p_user_id: userId,
      p_category_id: finalCategoryId,
      p_subcategory_id: finalSubcategoryId,
      p_description: encryptedDescription,
      p_description_search: descriptionSearch,
      p_recurring: data.recurring ?? false,
      p_expense_type: data.type === "expense" ? (data.expenseType || null) : null,
      p_created_at: now,
      p_updated_at: now,
      p_max_transactions: limits.maxTransactions,
    }
  );

  if (transactionError) {
    logger.error("Error creating transaction via SQL function:", transactionError);
    throw new Error(`Failed to create transaction: ${transactionError.message || JSON.stringify(transactionError)}`);
  }

  // Fetch the created transaction
  const { data: transaction, error: fetchError } = await supabase
    .from("Transaction")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !transaction) {
    logger.error("Error fetching created transaction:", fetchError);
    throw new Error("Failed to fetch created transaction");
  }

  // Update transaction with householdId if not set by SQL function
  if (householdId && !transaction.householdId) {
    const { error: updateError } = await supabase
      .from("Transaction")
      .update({ householdId })
      .eq("id", id);

    if (updateError) {
      logger.error("Error updating transaction with householdId:", updateError);
      // Don't fail the transaction creation if householdId update fails
    }
  }

  // Handle credit card payment (transfer without transferFromId) - update debt if this is a credit card account
  if (data.type === "transfer" && !data.transferFromId) {
    try {
      const { data: account } = await supabase
        .from('Account')
        .select('type')
        .eq('id', data.accountId)
        .single();

      if (account?.type === 'credit') {
        const activeDebt = await getActiveCreditCardDebt(data.accountId);
        if (activeDebt) {
          const paymentAmount = data.amount;
          const remainingDebt = activeDebt.currentBalance;
          let newBalance = remainingDebt - paymentAmount;
          let newStatus = "active";
          let newExtraCredit = 0;

          if (paymentAmount < remainingDebt) {
            newBalance = Math.max(0, newBalance);
            newStatus = "active";
          } else if (paymentAmount === remainingDebt) {
            newBalance = 0;
            newStatus = "closed";
          } else {
            const overPayment = paymentAmount - remainingDebt;
            newBalance = 0;
            newStatus = "closed";
            const { data: creditAccount } = await supabase
              .from('Account')
              .select('extraCredit')
              .eq('id', data.accountId)
              .single();
            newExtraCredit = (creditAccount?.extraCredit || 0) + overPayment;
          }

          const updateData: Record<string, unknown> = {
            currentBalance: newBalance,
            status: newStatus,
            updatedAt: formatTimestamp(new Date()),
          };

          if (newStatus === "closed") {
            updateData.isPaidOff = true;
            if (!activeDebt.paidOffAt) {
              updateData.paidOffAt = formatTimestamp(new Date());
            }
          }

          await supabase
            .from("Debt")
            .update(updateData)
            .eq("id", activeDebt.id);

          if (newExtraCredit > 0) {
            await supabase
              .from("Account")
              .update({ extraCredit: newExtraCredit })
              .eq("id", data.accountId);
          }

          logger.log("Updated credit card debt from transfer payment:", {
            debtId: activeDebt.id,
            paymentAmount,
            oldBalance: remainingDebt,
            newBalance,
            newStatus,
          });
        }
      }
    } catch (error) {
      logger.error("Error handling credit card payment via transfer (no transferFromId):", error);
      // Don't fail transaction creation
    }
  }

  // If we have a suggestion (any confidence level), save it for user approval/rejection
  if (categorySuggestion) {
    const { error: updateError } = await supabase
      .from('Transaction')
      .update({
        suggestedCategoryId: categorySuggestion.categoryId,
        suggestedSubcategoryId: categorySuggestion.subcategoryId || null,
        updatedAt: formatTimestamp(new Date()),
      })
      .eq('id', id);

    if (updateError) {
      logger.error('Error updating transaction with suggestion:', updateError);
    } else {
      logger.log('Transaction updated with category suggestion:', {
        transactionId: id,
        suggestedCategoryId: categorySuggestion.categoryId,
        confidence: categorySuggestion.confidence,
        matchCount: categorySuggestion.matchCount,
      });
    }
  }

  // Update category_learning when category is confirmed
  if (finalCategoryId) {
    await updateCategoryLearning(userId, descriptionSearch, data.type, finalCategoryId, finalSubcategoryId, data.amount);
  }

  // Invalidate cache to ensure dashboard shows updated data
  const { invalidateTransactionCaches } = await import('@/lib/services/cache-manager');
  invalidateTransactionCaches();

  // If transaction is recurring, generate PlannedPayments for future occurrences
  if (data.recurring) {
    try {
      await generatePlannedPaymentsFromRecurringTransaction(transaction.id);
      logger.info(`Generated planned payments for recurring transaction ${transaction.id}`);
    } catch (error) {
      logger.error(`Error generating planned payments for recurring transaction ${transaction.id}:`, error);
      // Don't fail the transaction creation if planned payment generation fails
    }
  }

  // Handle credit card expense: create or update debt automatically
  if (data.type === "expense") {
    try {
      const isCredit = await isCreditCardAccount(data.accountId);
      if (isCredit) {
        logger.log("Processing expense for credit card account:", {
          accountId: data.accountId,
          amount: data.amount,
        });
        
        const account = await getCreditCardAccount(data.accountId);
        if (account) {
          logger.log("Credit card account found:", {
            accountId: account.id,
            accountName: account.name,
            type: account.type,
            dueDayOfMonth: account.dueDayOfMonth,
            extraCredit: account.extraCredit,
          });
          const extraCredit = account.extraCredit || 0;
          let amountForDebt = data.amount;
          let newExtraCredit = extraCredit;

          // Always consider extraCredit first
          if (extraCredit > 0) {
            if (data.amount <= extraCredit) {
              // Consume entirely from extraCredit, no debt created/updated
              newExtraCredit = extraCredit - data.amount;
              amountForDebt = 0;
            } else {
              // Consume extraCredit completely, rest becomes debt
              amountForDebt = data.amount - extraCredit;
              newExtraCredit = 0;
            }

            // Update account extraCredit
            if (newExtraCredit !== extraCredit) {
              const { error: updateError } = await supabase
                .from("Account")
                .update({ extraCredit: newExtraCredit })
                .eq("id", data.accountId);
              
              if (updateError) {
                logger.error("Error updating account extraCredit:", updateError);
              }
            }
          }

          // For the amount that becomes debt
          if (amountForDebt > 0 && account.dueDayOfMonth !== null && account.dueDayOfMonth !== undefined) {
            const activeDebt = await getActiveCreditCardDebt(data.accountId);

            if (!activeDebt) {
              // Create new debt
              const nextDueDate = calculateNextDueDate(account.dueDayOfMonth);
              
              logger.log("Creating credit card debt:", {
                accountId: data.accountId,
                accountName: account.name,
                amountForDebt,
                nextDueDate: formatDateOnly(nextDueDate),
              });
              
              const newDebt = await createDebt({
                name: `${account.name} – Current Bill`,
                loanType: "credit_card",
                initialAmount: amountForDebt,
                downPayment: 0,
                interestRate: 0,
                totalMonths: null,
                firstPaymentDate: formatDateOnly(nextDueDate),
                monthlyPayment: 0,
                accountId: data.accountId,
                priority: "Medium",
                status: "active",
                nextDueDate: nextDueDate,
              });
              
              logger.log("Credit card debt created successfully:", {
                debtId: newDebt.id,
                name: newDebt.name,
                currentBalance: newDebt.currentBalance,
                status: newDebt.status,
              });
            } else {
              // Update existing debt
              const newBalance = activeDebt.currentBalance + amountForDebt;
              logger.log("Updating credit card debt:", {
                debtId: activeDebt.id,
                oldBalance: activeDebt.currentBalance,
                amountForDebt,
                newBalance,
              });
              
              await supabase
                .from("Debt")
                .update({
                  currentBalance: newBalance,
                  updatedAt: formatTimestamp(new Date()),
                })
                .eq("id", activeDebt.id);
            }
          } else if (amountForDebt > 0) {
            logger.log("Skipping debt creation - dueDayOfMonth not set:", {
              accountId: data.accountId,
              accountName: account.name,
              dueDayOfMonth: account.dueDayOfMonth,
            });
          }
        }
      }
    } catch (error) {
      // Log error but don't fail transaction creation
      logger.error("Error handling credit card debt for expense:", error);
    }
  }

  return transaction;
}

export async function updateTransaction(id: string, data: Partial<TransactionFormData>) {
    const supabase = await createServerClient();

  // Verify ownership before updating
  await requireTransactionOwnership(id);

  // Get current user for planned payment operations
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  // Get current transaction BEFORE update to check if recurring status changed
  const { data: transactionBeforeUpdate } = await supabase
    .from("Transaction")
    .select("recurring, accountId, type, amount")
    .eq("id", id)
    .single();

  // Get current transaction type if we need to validate expenseType
  let currentType: string | undefined = data.type;
  if (data.expenseType !== undefined && !currentType) {
    currentType = transactionBeforeUpdate?.type;
  }

  const updateData: Record<string, unknown> = {};
  if (data.date !== undefined) {
    // Handle date conversion properly to avoid timezone issues
    // If it's already a Date, use it; if it's a string (YYYY-MM-DD), parse it correctly
    let date: Date;
    if (data.date instanceof Date) {
      date = data.date;
    } else if (typeof data.date === 'string') {
      // If it's a string in YYYY-MM-DD format, use parseDateInput to avoid timezone issues
      date = parseDateInput(data.date);
    } else {
      // Fallback: try to create Date object
      date = new Date(data.date);
    }
    
    if (isNaN(date.getTime())) {
      throw new Error("Invalid date value");
    }
    // Use formatDateOnly to save only the date (YYYY-MM-DD) - now date type, not timestamp
    updateData.date = formatDateOnly(date);
  }
  if (data.type !== undefined) updateData.type = data.type;
  if (data.amount !== undefined) {
    // Amount is no longer encrypted - store directly as numeric
    updateData.amount = data.amount;
  }
  if (data.toAccountId !== undefined) updateData.transferToId = data.toAccountId || null;
  if (data.transferFromId !== undefined) updateData.transferFromId = data.transferFromId || null;
  if (data.accountId !== undefined) updateData.accountId = data.accountId;
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId || null;
  if (data.subcategoryId !== undefined) updateData.subcategoryId = data.subcategoryId || null;
  if (data.description !== undefined) {
    updateData.description = encryptDescription(data.description || null);
    // Also update description_search when description changes
    updateData.description_search = normalizeDescription(data.description);
  }
  if (data.recurring !== undefined) updateData.recurring = data.recurring;
  if (data.expenseType !== undefined) {
    // Only set expenseType if type is expense, otherwise set to null
    const finalType = data.type !== undefined ? data.type : currentType;
    updateData.expenseType = finalType === "expense" ? (data.expenseType || null) : null;
  }
  updateData.updatedAt = formatTimestamp(new Date());

  const { data: transaction, error } = await supabase
    .from("Transaction")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logger.error("Supabase error updating transaction:", error);
    throw new Error(`Failed to update transaction: ${error.message || JSON.stringify(error)}`);
  }

  if (!transaction) {
    throw new Error("Transaction not found after update");
  }

  // Update category_learning if categoryId changed
  if (data.categoryId !== undefined) {
    // Get current transaction to compare
    const { data: currentTransaction } = await supabase
      .from("Transaction")
      .select("description, type, amount, userId")
      .eq("id", id)
      .single();
    
    if (currentTransaction) {
      const desc = decryptDescription(currentTransaction.description || transaction.description);
      const normalizedDesc = normalizeDescription(desc);
      // Amount is now numeric, but support both during migration
      const txAmount = getTransactionAmount(transaction.amount) || 0;
      const txType = transaction.type;
      
      if (data.categoryId) {
        await updateCategoryLearning(
          currentTransaction.userId || (transaction as any).userId,
          normalizedDesc,
          txType,
          data.categoryId,
          data.subcategoryId || null,
          txAmount
        );
      }
    }
  }

  // Invalidate cache to ensure dashboard shows updated data
  const { invalidateTransactionCaches } = await import('@/lib/services/cache-manager');
  invalidateTransactionCaches();

  const wasRecurring = transactionBeforeUpdate?.recurring ?? false;
  const isNowRecurring = transaction.recurring;

  // If transaction was updated to be recurring or is already recurring and details changed
  if (data.recurring !== undefined && isNowRecurring) {
    try {
      // Delete existing planned payments that match this transaction's characteristics
      // (we'll regenerate them with updated data)
      // Amount is now numeric, but support both during migration
      const amount = getTransactionAmount(transaction.amount) ?? 0;
      const { error: deleteError } = await supabase
        .from("PlannedPayment")
        .delete()
        .eq("userId", user.id)
        .eq("accountId", transaction.accountId)
        .eq("type", transaction.type)
        .eq("source", "recurring")
        .eq("status", "scheduled")
        .eq("amount", amount);
      
      if (deleteError) {
        logger.error("Error deleting existing planned payments:", deleteError);
      }

      // Generate new planned payments
      await generatePlannedPaymentsFromRecurringTransaction(transaction.id);
      logger.info(`Regenerated planned payments for recurring transaction ${transaction.id}`);
    } catch (error) {
      logger.error(`Error generating planned payments for recurring transaction ${transaction.id}:`, error);
      // Don't fail the transaction update if planned payment generation fails
    }
  } else if (wasRecurring && !isNowRecurring) {
    // If transaction was changed from recurring to non-recurring, delete related planned payments
    try {
      // Amount is now numeric, but support both during migration
      const amount = getTransactionAmount(transactionBeforeUpdate?.amount ?? transaction.amount) ?? 0;
      const { error: deleteError } = await supabase
        .from("PlannedPayment")
        .delete()
        .eq("userId", user.id)
        .eq("accountId", transaction.accountId)
        .eq("type", transaction.type)
        .eq("source", "recurring")
        .eq("status", "scheduled")
        .eq("amount", amount);
      
      if (deleteError) {
        logger.error("Error deleting planned payments for non-recurring transaction:", deleteError);
      }
    } catch (error) {
      logger.error("Error cleaning up planned payments:", error);
    }
  }

  // Return transaction with decrypted fields
  // Amount is now numeric, but support both during migration
  const finalAmount = getTransactionAmount(transaction.amount) ?? 0;
  
  return {
    ...transaction,
    amount: finalAmount,
    description: decryptDescription(transaction.description),
  };
}

export async function deleteTransaction(id: string) {
    const supabase = await createServerClient();

  // Verify ownership before deleting
  await requireTransactionOwnership(id);

  // Get transaction first
  const { data: transaction, error: fetchError } = await supabase
    .from("Transaction")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !transaction) {
    logger.error("Supabase error fetching transaction:", fetchError);
    throw new Error("Transaction not found");
  }

  const { error } = await supabase.from("Transaction").delete().eq("id", id);
  if (error) {
    logger.error("Supabase error deleting transaction:", error);
    throw new Error(`Failed to delete transaction: ${error.message || JSON.stringify(error)}`);
  }

  // Invalidate cache to ensure dashboard shows updated data
  const { invalidateTransactionCaches } = await import('@/lib/services/cache-manager');
  invalidateTransactionCaches();
}

export async function deleteMultipleTransactions(ids: string[]) {
  const supabase = await createServerClient();

  if (ids.length === 0) {
    return;
  }

  // Verify ownership for all transactions before deleting
  for (const id of ids) {
    await requireTransactionOwnership(id);
  }

  // Verify all transactions exist first
  const { data: transactions, error: fetchError } = await supabase
    .from("Transaction")
    .select("id")
    .in("id", ids);

  if (fetchError) {
    logger.error("Supabase error fetching transactions:", fetchError);
    throw new Error("Failed to verify transactions");
  }

  if (!transactions || transactions.length !== ids.length) {
    throw new Error("Some transactions were not found");
  }

  const { error } = await supabase.from("Transaction").delete().in("id", ids);
  if (error) {
    logger.error("Supabase error deleting transactions:", error);
    throw new Error(`Failed to delete transactions: ${error.message || JSON.stringify(error)}`);
  }

  // Invalidate cache to ensure dashboard shows updated data
  const { invalidateTransactionCaches } = await import('@/lib/services/cache-manager');
  invalidateTransactionCaches();
}

export async function getTransactionsInternal(
  filters?: {
    startDate?: Date;
    endDate?: Date;
    categoryId?: string;
    accountId?: string;
    type?: string;
    search?: string;
    recurring?: boolean;
    page?: number;
    limit?: number;
  },
  accessToken?: string,
  refreshToken?: string
) {
  const supabase = await createServerClient(accessToken, refreshToken);

  // IMPORTANT: Buscar transações SEM joins primeiro para evitar problemas de RLS
  // Quando fazemos select('*, account:Account(*)'), o Supabase aplica RLS em Account também
  // Se Account RLS bloquear, a transação não aparece mesmo que Transaction RLS permita
  // Solução: Buscar transações primeiro, depois buscar relacionamentos separadamente
  
  // For pagination, we need to get the count first
  // Create a count query to get total number of transactions
  let countQuery = supabase
    .from("Transaction")
    .select("*", { count: 'exact', head: true });
  
  // OPTIMIZED: Select only necessary fields instead of * to reduce payload size
  // We'll fetch related data separately to avoid RLS issues
  let query = supabase
    .from("Transaction")
    .select("id, date, amount, type, description, categoryId, subcategoryId, accountId, recurring, createdAt, updatedAt, transferToId, transferFromId, tags, suggestedCategoryId, suggestedSubcategoryId, plaidMetadata, expenseType, userId, householdId")
    .order("date", { ascending: false });

  const log = logger.withPrefix("getTransactionsInternal");

  // Apply filters to both queries
  const applyFilters = (q: any) => {
    let filteredQuery = q;
    if (filters?.startDate) {
      filteredQuery = filteredQuery.gte("date", formatDateStart(filters.startDate));
    }
    if (filters?.endDate) {
      filteredQuery = filteredQuery.lte("date", formatDateEnd(filters.endDate));
    }
    if (filters?.categoryId) {
      filteredQuery = filteredQuery.eq("categoryId", filters.categoryId);
    }
    if (filters?.accountId) {
      filteredQuery = filteredQuery.eq("accountId", filters.accountId);
    }
    if (filters?.type) {
      if (filters.type === "transfer") {
        // Transfer transactions: either have type 'transfer' OR have transferToId/transferFromId set (for backward compatibility)
        filteredQuery = filteredQuery.or("type.eq.transfer,transferToId.not.is.null,transferFromId.not.is.null");
      } else {
        filteredQuery = filteredQuery.eq("type", filters.type);
      }
    }
    if (filters?.recurring !== undefined) {
      filteredQuery = filteredQuery.eq("recurring", filters.recurring);
    }
    // Use description_search for search (much faster than decrypting everything)
    // OPTIMIZED: Ignore search parameters that start with "_refresh_" - these are used for cache bypass only
    if (filters?.search && !filters.search.startsWith("_refresh_")) {
      const normalizedSearch = normalizeDescription(filters.search);
      // Use ILIKE for case-insensitive search on normalized description_search
      filteredQuery = filteredQuery.ilike("description_search", `%${normalizedSearch}%`);
    }
    return filteredQuery;
  };

  // Apply filters to both queries
  countQuery = applyFilters(countQuery);
  query = applyFilters(query);

  // Apply pagination if provided
  // Now that we use description_search, we can paginate in the database even with search
  if (filters?.page !== undefined && filters?.limit !== undefined) {
    const page = Math.max(1, filters.page);
    const limit = Math.max(1, Math.min(100, filters.limit)); // Limit max to 100
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);
  }

  // Verificar se o usuário está autenticado antes de executar a query
  const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
  
  // Se não estiver autenticado, retornar array vazio (não lançar erro)
  if (authError || !currentUser) {
    return { transactions: [], total: 0 };
  }

  // Execute count query and data query in parallel
  const [{ count }, { data, error }] = await Promise.all([
    countQuery,
    query
  ]);

  if (error) {
    logger.error("Supabase error fetching transactions:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      userId: currentUser?.id,
      queryFilters: filters,
    });
    throw new Error(`Failed to fetch transactions: ${error.message || JSON.stringify(error)}`);
  }

  if (!data || data.length === 0) {
    return { transactions: [], total: count || 0 };
  }

  // Buscar relacionamentos separadamente para evitar problemas de RLS com joins
  // Coletar IDs únicos de relacionamentos
  const accountIds = [...new Set(data.map((t: any) => t.accountId).filter(Boolean))];
  const categoryIds = [...new Set(data.map((t: any) => t.categoryId).filter(Boolean))];
  const subcategoryIds = [...new Set(data.map((t: any) => t.subcategoryId).filter(Boolean))];

  // Buscar todos os relacionamentos em paralelo para melhor performance
  // OPTIMIZED: Select only necessary fields instead of * to reduce payload size
  // Note: balance is calculated, not a column in the database
  const [accountsResult, categoriesResult, subcategoriesResult] = await Promise.all([
    accountIds.length > 0 
      ? supabase.from("Account").select("id, name, type, initialBalance").in("id", accountIds)
      : Promise.resolve({ data: null, error: null }),
    categoryIds.length > 0
      ? supabase.from("Category").select("id, name, groupId").in("id", categoryIds)
      : Promise.resolve({ data: null, error: null }),
    subcategoryIds.length > 0
      ? supabase.from("Subcategory").select("id, name, categoryId, logo").in("id", subcategoryIds)
      : Promise.resolve({ data: null, error: null }),
  ]);

  // Log errors when fetching categories (for debugging category display issues)
  if (categoriesResult.error) {
    logger.error("getTransactionsInternal: Error fetching categories", {
      error: categoriesResult.error,
      categoryIds,
      message: categoriesResult.error.message,
    });
  }

  // Criar maps para acesso rápido
  const accountsMap = new Map();
  if (accountsResult.data) {
    accountsResult.data.forEach((acc: any) => {
      accountsMap.set(acc.id, acc);
    });
  }

  const categoriesMap = new Map();
  if (categoriesResult.data) {
    categoriesResult.data.forEach((cat: any) => {
      categoriesMap.set(cat.id, cat);
    });
  }
  
  // Log if there are categoryIds but no categories found (for debugging)
  if (categoryIds.length > 0 && (!categoriesResult.data || categoriesResult.data.length === 0)) {
    logger.warn("getTransactionsInternal: Found categoryIds but no categories were returned", {
      categoryIds,
      error: categoriesResult.error,
      dataLength: categoriesResult.data?.length || 0,
    });
  }
  
  // Log if there are categoryIds but some are missing
  if (categoryIds.length > 0 && categoriesResult.data) {
    const foundIds = new Set(categoriesResult.data.map((cat: any) => cat.id));
    const missingIds = categoryIds.filter(id => !foundIds.has(id));
    if (missingIds.length > 0) {
      logger.warn("getTransactionsInternal: Some categoryIds were not found in database", {
        missingIds,
        foundIds: Array.from(foundIds),
        requestedIds: categoryIds,
      });
    }
  }

  const subcategoriesMap = new Map();
  if (subcategoriesResult.data) {
    subcategoriesResult.data.forEach((sub: any) => {
      subcategoriesMap.set(sub.id, sub);
    });
  }

  // Combine transactions with relationships
  // Amount is now numeric (no longer encrypted)
  // Decrypt description (description_search is only for search, not display)
  const { decryptDescription } = await import("@/lib/utils/transaction-encryption");
  
  let transactions = (data || []).map((tx: any) => {
    // Amount is numeric (no longer encrypted after migration)
    const amount = typeof tx.amount === 'number' ? tx.amount : (getTransactionAmount(tx.amount) ?? 0);
    
    // Get category and subcategory from maps
    const category = categoriesMap.get(tx.categoryId) || null;
    const subcategory = subcategoriesMap.get(tx.subcategoryId) || null;
    
    // Log if categoryId exists but category is not found (for debugging)
    if (tx.categoryId && !category) {
      logger.warn("getTransactionsInternal: Transaction has categoryId but category not found", {
        transactionId: tx.id,
        categoryId: tx.categoryId,
        availableCategoryIds: Array.from(categoriesMap.keys()),
        allCategoryIds: categoryIds,
      });
    }
    
    return {
      ...tx,
      amount: amount,
      description: decryptDescription(tx.description),
      account: accountsMap.get(tx.accountId) || null,
      category: category,
      subcategory: subcategory,
    };
  });

  // Search is now done in the database using description_search, so no need to filter in memory
  // Pagination is also done in the database
  const paginatedTransactions = transactions;
  
  // Total count from database (search filtering is done in SQL)
  const totalCount = count || 0;

  return { 
    transactions: paginatedTransactions, 
    total: totalCount 
  };
}

export async function getTransactions(filters?: {
  startDate?: Date;
  endDate?: Date;
  categoryId?: string;
  accountId?: string;
  type?: string;
  search?: string;
  recurring?: boolean;
  page?: number;
  limit?: number;
}) {
  // Get tokens from Supabase client directly (not from cookies)
  // This is more reliable because Supabase SSR manages cookies automatically
  let accessToken: string | undefined;
  let refreshToken: string | undefined;
  
  try {
    const supabase = await createServerClient();
    // SECURITY: Use getUser() first to verify authentication, then getSession() for tokens
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // Only get session tokens if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        accessToken = session.access_token;
        refreshToken = session.refresh_token;
      }
    }
  } catch (error: any) {
      // If we can't get tokens (e.g., inside unstable_cache), continue without them
      logger.warn("Could not get tokens:", error?.message);
  }
  
  // Cache for 10 seconds if no search filter (searches should be real-time)
  // Cache is invalidated via revalidateTag('transactions') when transactions are created/updated/deleted
  // Shorter cache time ensures fresh data while maintaining performance
  if (!filters?.search) {
    const cacheKey = `transactions-${filters?.startDate?.toISOString()}-${filters?.endDate?.toISOString()}-${filters?.categoryId || 'all'}-${filters?.accountId || 'all'}-${filters?.type || 'all'}-${filters?.recurring || 'all'}`;
    return unstable_cache(
      async () => getTransactionsInternal(filters, accessToken, refreshToken),
      [cacheKey],
      { revalidate: 10, tags: ['transactions'] }
    )();
  }
  
  return getTransactionsInternal(filters, accessToken, refreshToken);
}

export async function getUpcomingTransactions(limit: number = 5, accessToken?: string, refreshToken?: string) {
  // Check authentication first to avoid RLS errors
  const supabase = await createServerClient(accessToken, refreshToken);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    // User not authenticated, return empty array
    return [];
  }

  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + 15); // Look ahead 15 days
  endDate.setHours(23, 59, 59, 999);

  // Get all scheduled planned payments (from all sources: recurring, debt, manual)
  const result = await getPlannedPayments({
    startDate: today,
    endDate: endDate,
    status: "scheduled",
  });
  const plannedPayments = result?.plannedPayments || [];

  // Convert PlannedPayments to the expected format
  const upcoming = plannedPayments.map((pp) => {
    const ppDate = pp.date instanceof Date ? pp.date : new Date(pp.date);
    return {
      id: pp.id,
      date: ppDate,
      type: pp.type,
      amount: pp.amount,
      description: pp.description || undefined,
      account: pp.account,
      category: pp.category,
      subcategory: pp.subcategory,
      originalDate: ppDate,
      isDebtPayment: pp.source === "debt",
    };
  });

  // Also get recurring transactions and generate planned payments for them
  // This is a temporary solution until we fully migrate to PlannedPayments
  const { data: recurringTransactions, error: recurringError } = await supabase
    .from("Transaction")
    .select(`
      *,
      account:Account(*),
      category:Category!Transaction_categoryId_fkey(*),
      subcategory:Subcategory!Transaction_subcategoryId_fkey(id, name, logo)
    `)
    .eq("recurring", true)
    .order("date", { ascending: true });

  if (recurringError) {
    logger.error("Supabase error fetching recurring transactions:", recurringError);
  }

  // Generate planned payments for recurring transactions (if not already created)
  for (const tx of recurringTransactions || []) {
    const originalDate = new Date(tx.date);
    const originalDay = originalDate.getDate();
    
    // Calculate next occurrence
    let nextDate = new Date(today.getFullYear(), today.getMonth(), originalDay);
    nextDate.setHours(0, 0, 0, 0);
    
    if (nextDate.getDate() !== originalDay) {
      nextDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      nextDate.setHours(0, 0, 0, 0);
    }

    if (nextDate < today) {
      nextDate = new Date(today.getFullYear(), today.getMonth() + 1, originalDay);
      nextDate.setHours(0, 0, 0, 0);
      if (nextDate.getDate() !== originalDay) {
        nextDate = new Date(today.getFullYear(), today.getMonth() + 2, 0);
        nextDate.setHours(0, 0, 0, 0);
      }
    }

    // Only include if within the next 15 days and not already in planned payments
    if (nextDate <= endDate) {
      const alreadyExists = plannedPayments.some(
        (pp) => pp.source === "recurring" && 
        new Date(pp.date).getTime() === nextDate.getTime() &&
        pp.accountId === tx.accountId &&
        pp.amount === (getTransactionAmount(tx.amount) ?? 0)
      );

      if (!alreadyExists) {
        let account = null;
        if (tx.account) {
          account = Array.isArray(tx.account) ? (tx.account.length > 0 ? tx.account[0] : null) : tx.account;
        }

        let category = null;
        if (tx.category) {
          category = Array.isArray(tx.category) ? (tx.category.length > 0 ? tx.category[0] : null) : tx.category;
        }

        let subcategory = null;
        if (tx.subcategory) {
          subcategory = Array.isArray(tx.subcategory) ? (tx.subcategory.length > 0 ? tx.subcategory[0] : null) : tx.subcategory;
        }

        upcoming.push({
          id: `recurring-${tx.id}-${nextDate.toISOString()}`,
          date: nextDate,
          type: tx.type,
          amount: getTransactionAmount(tx.amount) ?? 0,
          description: decryptDescription(tx.description) ?? undefined,
          account: account || null,
          category: category || null,
          subcategory: subcategory || null,
          originalDate: originalDate,
          isDebtPayment: false,
        });
      }
    }
  }

  // Sort by date and limit
  upcoming.sort((a, b) => a.date.getTime() - b.date.getTime());
  const debtCount = upcoming.filter(t => t.isDebtPayment).length;
  const nonDebtCount = upcoming.length - debtCount;
  console.log(`[getUpcomingTransactions] Returning ${upcoming.length} upcoming items (planned payments: ${plannedPayments.length}, recurring: ${upcoming.length - plannedPayments.length}, debts: ${debtCount})`);
  
  return upcoming;
}

export async function getAccountBalance(accountId: string) {
    const supabase = await createServerClient();

  // Get account to retrieve initialBalance
  const { data: account } = await supabase
    .from("Account")
    .select("initialBalance")
    .eq("id", accountId)
    .single();

  const initialBalance = (account?.initialBalance as number) ?? 0;

  // Only include transactions with date <= today (exclude future transactions)
  // Use a consistent date comparison to avoid timezone issues
  const now = new Date();
  const todayYear = now.getFullYear();
  const todayMonth = now.getMonth();
  const todayDay = now.getDate();
  
  // Create date for end of today in local timezone, then convert to ISO for query
  const todayEnd = new Date(todayYear, todayMonth, todayDay, 23, 59, 59, 999);

  const { data: transactions, error } = await supabase
    .from("Transaction")
    .select("type, amount, date")
    .eq("accountId", accountId)
    .lte("date", todayEnd.toISOString());

  if (error) {
    return initialBalance;
  }

  // Compare dates by year, month, day only to avoid timezone issues
  const todayDate = new Date(todayYear, todayMonth, todayDay);

  let balance = initialBalance;
  for (const tx of transactions || []) {
    // Parse transaction date and compare only date part (ignore time)
    const txDateObj = new Date(tx.date);
    const txYear = txDateObj.getFullYear();
    const txMonth = txDateObj.getMonth();
    const txDay = txDateObj.getDate();
    const txDate = new Date(txYear, txMonth, txDay);
    
    // Skip future transactions (date > today)
    if (txDate > todayDate) {
      continue;
    }
    
    // Get amount (numeric or decrypt during migration)
    const amount = getTransactionAmount(tx.amount);
    
    // Skip transaction if amount is invalid (null, NaN, or unreasonably large)
    if (amount === null || isNaN(amount) || !isFinite(amount)) {
      logger.warn('Skipping transaction with invalid amount:', {
        accountId,
        amount: tx.amount,
        decryptedAmount: amount,
      });
      continue;
    }
    
    if (tx.type === "income") {
      balance += amount;
    } else if (tx.type === "expense") {
      balance -= amount;
    }
  }

  return balance;
}
