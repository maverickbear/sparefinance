"use server";

import { createServerClient } from "@/lib/supabase-server";
import { getCurrentUserId } from "@/lib/api/feature-guard";
import { SecurityLogger } from "@/lib/utils/security-logging";

/**
 * Security utility functions for authorization checks
 */

/**
 * Verify if the current user owns an account
 * Also checks AccountOwner relationships for household members
 */
export async function verifyAccountOwnership(accountId: string): Promise<boolean> {
  try {
    const supabase = await createServerClient();
    const userId = await getCurrentUserId();
    
    if (!userId) {
      return false;
    }

    // Check if account exists and user is owner via userId
    const { data: account, error: accountError } = await supabase
      .from("Account")
      .select("id, userId")
      .eq("id", accountId)
      .single();

    if (accountError || !account) {
      return false;
    }

    // Check direct ownership via userId
    if (account.userId === userId) {
      return true;
    }

    // Check AccountOwner relationships for household members
    const { data: accountOwner, error: ownerError } = await supabase
      .from("AccountOwner")
      .select("ownerId")
      .eq("accountId", accountId)
      .eq("ownerId", userId)
      .single();

    if (!ownerError && accountOwner) {
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error verifying account ownership:", error);
    return false;
  }
}

/**
 * Verify if the current user owns a transaction
 * Transactions are owned directly via userId or through their account
 */
export async function verifyTransactionOwnership(transactionId: string): Promise<boolean> {
  try {
    const supabase = await createServerClient();
    const userId = await getCurrentUserId();
    
    if (!userId) {
      return false;
    }

    // Get transaction with userId and accountId
    const { data: transaction, error: transactionError } = await supabase
      .from("Transaction")
      .select("id, userId, accountId")
      .eq("id", transactionId)
      .single();

    if (transactionError || !transaction) {
      return false;
    }

    // First check: User owns the transaction directly via userId
    if (transaction.userId === userId) {
      return true;
    }

    // Second check: Verify account ownership (fallback for old data or shared accounts)
    return await verifyAccountOwnership(transaction.accountId);
  } catch (error) {
    console.error("Error verifying transaction ownership:", error);
    return false;
  }
}

/**
 * Verify if the current user owns a budget
 */
export async function verifyBudgetOwnership(budgetId: string): Promise<boolean> {
  try {
    const supabase = await createServerClient();
    const userId = await getCurrentUserId();
    
    if (!userId) {
      return false;
    }

    const { data: budget, error: budgetError } = await supabase
      .from("Budget")
      .select("id, userId")
      .eq("id", budgetId)
      .single();

    if (budgetError || !budget) {
      return false;
    }

    return budget.userId === userId;
  } catch (error) {
    console.error("Error verifying budget ownership:", error);
    return false;
  }
}

/**
 * Verify if the current user owns a goal
 */
export async function verifyGoalOwnership(goalId: string): Promise<boolean> {
  try {
    const supabase = await createServerClient();
    const userId = await getCurrentUserId();
    
    if (!userId) {
      return false;
    }

    const { data: goal, error: goalError } = await supabase
      .from("Goal")
      .select("id, userId")
      .eq("id", goalId)
      .single();

    if (goalError || !goal) {
      return false;
    }

    return goal.userId === userId;
  } catch (error) {
    console.error("Error verifying goal ownership:", error);
    return false;
  }
}

/**
 * Verify if the current user owns a debt
 */
export async function verifyDebtOwnership(debtId: string): Promise<boolean> {
  try {
    const supabase = await createServerClient();
    const userId = await getCurrentUserId();
    
    if (!userId) {
      return false;
    }

    const { data: debt, error: debtError } = await supabase
      .from("Debt")
      .select("id, userId")
      .eq("id", debtId)
      .single();

    if (debtError || !debt) {
      return false;
    }

    return debt.userId === userId;
  } catch (error) {
    console.error("Error verifying debt ownership:", error);
    return false;
  }
}

/**
 * Throw an error if the user doesn't own the resource
 */
export async function requireAccountOwnership(accountId: string): Promise<void> {
  const userId = await getCurrentUserId();
  const isOwner = await verifyAccountOwnership(accountId);
  if (!isOwner) {
    SecurityLogger.idorAttempt(
      `Unauthorized access attempt to account ${accountId}`,
      {
        userId: userId || undefined,
        resourceId: accountId,
        resourceType: "Account",
      }
    );
    throw new Error("Unauthorized: You don't have permission to access this account");
  }
}

export async function requireTransactionOwnership(transactionId: string): Promise<void> {
  const userId = await getCurrentUserId();
  const isOwner = await verifyTransactionOwnership(transactionId);
  if (!isOwner) {
    SecurityLogger.idorAttempt(
      `Unauthorized access attempt to transaction ${transactionId}`,
      {
        userId: userId || undefined,
        resourceId: transactionId,
        resourceType: "Transaction",
      }
    );
    throw new Error("Unauthorized: You don't have permission to access this transaction");
  }
}

export async function requireBudgetOwnership(budgetId: string): Promise<void> {
  const userId = await getCurrentUserId();
  const isOwner = await verifyBudgetOwnership(budgetId);
  if (!isOwner) {
    SecurityLogger.idorAttempt(
      `Unauthorized access attempt to budget ${budgetId}`,
      {
        userId: userId || undefined,
        resourceId: budgetId,
        resourceType: "Budget",
      }
    );
    throw new Error("Unauthorized: You don't have permission to access this budget");
  }
}

export async function requireGoalOwnership(goalId: string): Promise<void> {
  const userId = await getCurrentUserId();
  const isOwner = await verifyGoalOwnership(goalId);
  if (!isOwner) {
    SecurityLogger.idorAttempt(
      `Unauthorized access attempt to goal ${goalId}`,
      {
        userId: userId || undefined,
        resourceId: goalId,
        resourceType: "Goal",
      }
    );
    throw new Error("Unauthorized: You don't have permission to access this goal");
  }
}

export async function requireDebtOwnership(debtId: string): Promise<void> {
  const userId = await getCurrentUserId();
  const isOwner = await verifyDebtOwnership(debtId);
  if (!isOwner) {
    SecurityLogger.idorAttempt(
      `Unauthorized access attempt to debt ${debtId}`,
      {
        userId: userId || undefined,
        resourceId: debtId,
        resourceType: "Debt",
      }
    );
    throw new Error("Unauthorized: You don't have permission to access this debt");
  }
}

