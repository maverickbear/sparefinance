"use server";

import { revalidateTag } from "next/cache";
import { createServerClient } from "@/lib/supabase-server";
import { AccountFormData } from "@/lib/validations/account";
import { getCurrentTimestamp, formatTimestamp } from "@/lib/utils/timestamp";
import { getAccountBalance } from "./transactions";
import { guardAccountLimit, throwIfNotAllowed } from "@/lib/api/feature-guard";
import { requireAccountOwnership } from "@/lib/utils/security";
import { logger } from "@/lib/utils/logger";

export async function getAccounts(accessToken?: string, refreshToken?: string) {
    const supabase = await createServerClient(accessToken, refreshToken);

  // Verify user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    logger.error("[getAccounts] User not authenticated:", authError?.message);
    return [];
  }

  logger.debug("[getAccounts] Fetching accounts for user:", user.id);

  const { data: accounts, error } = await supabase
    .from("Account")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    logger.error("[getAccounts] Error fetching accounts:", error);
    return [];
  }

  logger.debug("[getAccounts] Found accounts:", accounts?.length || 0);

  if (!accounts) {
    return [];
  }

  // Fetch all transactions up to today in one query to avoid N+1 queries
  // Only include transactions with date <= today (exclude future transactions)
  // Use a consistent date comparison to avoid timezone issues
  const now = new Date();
  const todayYear = now.getFullYear();
  const todayMonth = now.getMonth();
  const todayDay = now.getDate();
  
  // Create date for end of today in local timezone, then convert to ISO for query
  const todayEnd = new Date(todayYear, todayMonth, todayDay, 23, 59, 59, 999);
  
  const { data: transactions } = await supabase
    .from("Transaction")
    .select("accountId, type, amount, date")
    .lte("date", todayEnd.toISOString());

  // Calculate balances using optimized service
  // Import batch decryption for better performance
  const { decryptTransactionsBatch } = await import("@/lib/utils/transaction-encryption");
  const { calculateAccountBalances } = await import("@/lib/services/balance-calculator");
  
  // Decrypt transactions in batch
  const decryptedTransactions = decryptTransactionsBatch(transactions || []);
  
  // Map accounts to the format expected by balance calculator
  const accountsWithInitialBalance = accounts.map(account => ({
    ...account,
    initialBalance: (account as any).initialBalance ?? 0,
    balance: 0, // Will be calculated
  }));
    
  // Calculate all balances in one efficient pass
  const balances = calculateAccountBalances(
    accountsWithInitialBalance,
    decryptedTransactions as any,
    todayEnd
  );

  // Handle investment accounts separately - calculate from holdings
  const investmentAccounts = accounts.filter(acc => acc.type === "investment");
  if (investmentAccounts.length > 0) {
    const investmentAccountIds = investmentAccounts.map(acc => acc.id);
    
    // 1. First, try to get values from InvestmentAccount (Questrade connected accounts)
    const { data: questradeAccounts } = await supabase
      .from("InvestmentAccount")
      .select("accountId, totalEquity, marketValue, cash")
      .in("accountId", investmentAccountIds)
      .not("accountId", "is", null);
    
    if (questradeAccounts) {
      for (const questradeAccount of questradeAccounts) {
        if (questradeAccount.accountId) {
          const totalEquity = questradeAccount.totalEquity != null 
            ? Number(questradeAccount.totalEquity) 
            : null;
          const marketValue = questradeAccount.marketValue != null 
            ? Number(questradeAccount.marketValue) 
            : 0;
          const cash = questradeAccount.cash != null 
            ? Number(questradeAccount.cash) 
            : 0;
          
          const accountValue = totalEquity ?? (marketValue + cash);
          balances.set(questradeAccount.accountId, accountValue);
        }
      }
    }
    
    // 2. For accounts without Questrade data, try AccountInvestmentValue (simple investments)
    const accountsWithoutQuestrade = investmentAccountIds.filter(
      accountId => !balances.has(accountId)
    );
    
    if (accountsWithoutQuestrade.length > 0) {
      const { data: investmentValues } = await supabase
        .from("AccountInvestmentValue")
        .select("accountId, totalValue")
        .in("accountId", accountsWithoutQuestrade);
      
      if (investmentValues) {
        for (const investmentValue of investmentValues) {
          const totalValue = investmentValue.totalValue != null 
            ? Number(investmentValue.totalValue) 
            : 0;
          balances.set(investmentValue.accountId, totalValue);
        }
      }
    }
    
    // 3. OPTIMIZED: Calculate from holdings for all investment accounts
    // This ensures we get accurate balances even when InvestmentAccount values are null/0
    // We'll calculate from holdings and use the higher value (InvestmentAccount or holdings sum)
    try {
      // Only fetch holdings if we actually have investment accounts
      // This is a lazy load optimization - getHoldings() is expensive
      const { getHoldings } = await import("@/lib/api/investments");
      const holdings = await getHoldings(undefined, accessToken, refreshToken);
      
      logger.debug(`[getAccounts] Fetched ${holdings.length} holdings for ${investmentAccountIds.length} investment accounts`);
      
      // Create a map from InvestmentAccount.id to Account.id for Questrade accounts
      // Holdings from Questrade use InvestmentAccount.id, but we need Account.id
      const investmentAccountMap = new Map<string, string>();
      if (investmentAccounts.length > 0) {
        const { data: investmentAccountsData } = await supabase
          .from("InvestmentAccount")
          .select("id, accountId")
          .in("accountId", investmentAccountIds)
          .not("accountId", "is", null);
        
        if (investmentAccountsData) {
          for (const ia of investmentAccountsData) {
            if (ia.accountId) {
              investmentAccountMap.set(ia.id, ia.accountId);
            }
          }
        }
      }
      
      // Calculate value for each account based on holdings
      for (const accountId of investmentAccountIds) {
        // Holdings may have accountId as InvestmentAccount.id (from Questrade) or Account.id (from transactions)
        // We need to check both
        const accountHoldings = holdings.filter((h: any) => {
          // Direct match (from transactions)
          if (h.accountId === accountId) {
            return true;
          }
          // Check if this holding's accountId is an InvestmentAccount that maps to our Account.id
          const mappedAccountId = investmentAccountMap.get(h.accountId);
          return mappedAccountId === accountId;
        });
        
        const holdingsValue = accountHoldings.reduce((sum: number, h: any) => {
          return sum + (h.marketValue || 0);
        }, 0);
        
        // Use the higher value: InvestmentAccount value (if exists) or holdings sum
        // This ensures we show the correct balance even if InvestmentAccount values are stale
        const existingBalance = balances.get(accountId) || 0;
        const finalBalance = holdingsValue > existingBalance ? holdingsValue : existingBalance;
        
        logger.debug(`[getAccounts] Account ${accountId}: ${accountHoldings.length} holdings, holdings value: ${holdingsValue}, existing: ${existingBalance}, final: ${finalBalance}`);
        
        // Always set the balance to the calculated value
        balances.set(accountId, finalBalance);
      }
    } catch (error) {
      logger.error("Error fetching holdings for account values:", error);
      console.error("Error fetching holdings for account values:", error);
      // Continue without failing - will use existing balances or 0
    }
    
    // 4. For accounts without any value, set to 0
    investmentAccounts.forEach(account => {
      if (!balances.has(account.id)) {
        balances.set(account.id, 0);
      }
    });
  }

  // Fetch AccountOwner relationships for all accounts
  const { data: accountOwners } = await supabase
    .from("AccountOwner")
    .select("accountId, ownerId");

  // Create a map: accountId -> ownerIds[]
  const accountOwnersMap = new Map<string, string[]>();
  accountOwners?.forEach((ao) => {
    if (!accountOwnersMap.has(ao.accountId)) {
      accountOwnersMap.set(ao.accountId, []);
    }
    accountOwnersMap.get(ao.accountId)!.push(ao.ownerId);
  });

  // Get all unique owner IDs
  const allOwnerIds = new Set<string>();
  accountOwners?.forEach((ao) => {
    allOwnerIds.add(ao.ownerId);
  });

  // Also include userIds from accounts for backward compatibility
  accounts.forEach((acc) => {
    if (acc.userId) {
      allOwnerIds.add(acc.userId);
    }
  });

  // Fetch owner names
  const { data: owners } = await supabase
    .from("User")
    .select("id, name")
    .in("id", Array.from(allOwnerIds));

  // Create a map: ownerId -> ownerName (first name only)
  const ownerNameMap = new Map<string, string>();
  owners?.forEach((owner) => {
    if (owner.id && owner.name) {
      // Extract only the first name
      const firstName = owner.name.split(' ')[0];
      ownerNameMap.set(owner.id, firstName);
    }
  });

  // Combine accounts with their balances and household names
  const accountsWithBalances = accounts.map((account) => {
    const ownerIds = accountOwnersMap.get(account.id) || 
      (account.userId ? [account.userId] : []);
    
    // Get household names for all owners
    const householdNames = ownerIds
      .map(ownerId => ownerNameMap.get(ownerId))
      .filter(Boolean) as string[];
    
    // Join multiple household names with comma
    const householdName = householdNames.length > 0 
      ? householdNames.join(", ") 
      : null;

    return {
      ...account,
      balance: balances.get(account.id) || 0,
      householdName,
      ownerIds, // Include ownerIds in response
    };
  });

  return accountsWithBalances;
}

export async function createAccount(data: AccountFormData) {
    const supabase = await createServerClient();

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  // Check account limit before creating
  const limitGuard = await guardAccountLimit(user.id);
  await throwIfNotAllowed(limitGuard);

  // Generate UUID for the account
  const id = crypto.randomUUID();
  const now = formatTimestamp(new Date());

  // Determine owner IDs: use provided ownerIds or default to current user
  const ownerIds = data.ownerIds && data.ownerIds.length > 0 
    ? data.ownerIds 
    : [user.id];

  const { data: account, error } = await supabase
    .from("Account")
    .insert({
      id,
      name: data.name,
      type: data.type,
      creditLimit: data.type === "credit" ? data.creditLimit : null,
      initialBalance: (data.type === "checking" || data.type === "savings") ? (data.initialBalance ?? 0) : null,
      dueDayOfMonth: data.type === "credit" ? (data.dueDayOfMonth ?? null) : null,
      userId: user.id, // Keep userId for backward compatibility and RLS
      createdAt: now,
      updatedAt: now,
    })
    .select()
    .single();

  if (error) {
    console.error("Supabase error creating account:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    throw new Error(`Failed to create account: ${error.message || JSON.stringify(error)}`);
  }

  // Create AccountOwner entries for each owner
  if (ownerIds.length > 0) {
    const accountOwners = ownerIds.map(ownerId => ({
      accountId: id,
      ownerId,
      createdAt: now,
      updatedAt: now,
    }));

    // Don't select the inserted data to reduce overhead
    const { error: ownersError } = await supabase
      .from("AccountOwner")
      .insert(accountOwners);

    if (ownersError) {
      console.error("Supabase error creating account owners:", {
        error: ownersError,
        message: ownersError.message,
        details: ownersError.details,
        hint: ownersError.hint,
        code: ownersError.code,
        ownerIds,
        accountId: id,
      });
      // Fail the account creation if owners can't be created
      throw new Error(`Failed to create account owners: ${ownersError.message || JSON.stringify(ownersError)}`);
    }
  }

  // Invalidate cache to ensure dashboard shows updated data
  revalidateTag('accounts', 'max');
  revalidateTag('dashboard', 'max');

  return account;
}

export async function updateAccount(id: string, data: Partial<AccountFormData>) {
    const supabase = await createServerClient();

  // Verify ownership before updating
  await requireAccountOwnership(id);

  const updateData: Record<string, unknown> = { ...data };
  
  // Remove ownerIds from updateData as it's handled separately
  const ownerIds = updateData.ownerIds as string[] | undefined;
  delete updateData.ownerIds;
  
  // Handle creditLimit: set to null if not credit type, otherwise use provided value
  if (data.type !== undefined) {
    if (data.type === "credit") {
      updateData.creditLimit = data.creditLimit ?? null;
      updateData.initialBalance = null;
      // Handle dueDayOfMonth: keep it if provided, otherwise set to null when changing to credit
      if (data.dueDayOfMonth !== undefined) {
        updateData.dueDayOfMonth = data.dueDayOfMonth;
      }
    } else {
      updateData.creditLimit = null;
      updateData.dueDayOfMonth = null;
    }
  } else if (data.creditLimit !== undefined) {
    // If only creditLimit is being updated, keep it as is
    updateData.creditLimit = data.creditLimit;
  }
  
  // Handle dueDayOfMonth: update if provided (only for credit cards)
  if (data.dueDayOfMonth !== undefined) {
    updateData.dueDayOfMonth = data.dueDayOfMonth;
  }
  
  // Handle initialBalance: set to null if not checking/savings type, otherwise use provided value
  if (data.type !== undefined) {
    if (data.type === "checking" || data.type === "savings") {
      updateData.initialBalance = data.initialBalance ?? 0;
    } else {
      updateData.initialBalance = null;
    }
  } else if (data.initialBalance !== undefined) {
    // If only initialBalance is being updated, keep it as is
    updateData.initialBalance = data.initialBalance;
  }
  
  updateData.updatedAt = formatTimestamp(new Date());

  const { data: account, error } = await supabase
    .from("Account")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Supabase error updating account:", error);
    throw new Error(`Failed to update account: ${error.message || JSON.stringify(error)}`);
  }

  // Update AccountOwner entries if ownerIds are provided
  if (ownerIds !== undefined) {
    // Ensure at least one owner is provided
    if (ownerIds.length === 0) {
      throw new Error("At least one account owner is required");
    }

    const now = formatTimestamp(new Date());
    
    // Delete existing owners
    const { error: deleteError } = await supabase
      .from("AccountOwner")
      .delete()
      .eq("accountId", id);

    if (deleteError) {
      console.error("Supabase error deleting account owners:", deleteError);
      throw new Error(`Failed to update account owners: ${deleteError.message || JSON.stringify(deleteError)}`);
    }

    // Insert new owners
    const accountOwners = ownerIds.map(ownerId => ({
      accountId: id,
      ownerId,
      createdAt: now,
      updatedAt: now,
    }));

    const { error: ownersError } = await supabase
      .from("AccountOwner")
      .insert(accountOwners);

    if (ownersError) {
      console.error("Supabase error updating account owners:", ownersError);
      throw new Error(`Failed to update account owners: ${ownersError.message || JSON.stringify(ownersError)}`);
    }
  }

  // Invalidate cache to ensure dashboard shows updated data
  const { invalidateAccountCaches } = await import('@/lib/services/cache-manager');
  invalidateAccountCaches();

  return account;
}

/**
 * Transfer all transactions from one account to another
 */
export async function transferAccountTransactions(
  fromAccountId: string,
  toAccountId: string
): Promise<{ transferred: number }> {
  const supabase = await createServerClient();

  // Verify ownership of both accounts
  await requireAccountOwnership(fromAccountId);
  await requireAccountOwnership(toAccountId);

  // Get all transactions for the source account
  const { data: transactions, error: fetchError } = await supabase
    .from("Transaction")
    .select("id")
    .eq("accountId", fromAccountId);

  if (fetchError) {
    console.error("Supabase error fetching transactions:", fetchError);
    throw new Error(`Failed to fetch transactions: ${fetchError.message || JSON.stringify(fetchError)}`);
  }

  if (!transactions || transactions.length === 0) {
    return { transferred: 0 };
  }

  // Update all transactions to the new account
  const { error: updateError } = await supabase
    .from("Transaction")
    .update({ accountId: toAccountId })
    .eq("accountId", fromAccountId);

  if (updateError) {
    console.error("Supabase error transferring transactions:", updateError);
    throw new Error(`Failed to transfer transactions: ${updateError.message || JSON.stringify(updateError)}`);
  }

  // Also handle transfer transactions that might reference this account
  // Update transactions where toAccountId references the account being deleted
  const { error: transferUpdateError } = await supabase
    .from("Transaction")
    .update({ toAccountId: toAccountId })
    .eq("toAccountId", fromAccountId);

  if (transferUpdateError) {
    console.error("Supabase error updating transfer transactions:", transferUpdateError);
    // Don't throw - this is not critical, just log it
  }

  // Invalidate cache
  const { invalidateTransactionCaches, invalidateAccountCaches } = await import('@/lib/services/cache-manager');
  invalidateTransactionCaches();
  invalidateAccountCaches();

  return { transferred: transactions.length };
}

/**
 * Check if an account has associated transactions
 */
export async function accountHasTransactions(accountId: string): Promise<boolean> {
  const supabase = await createServerClient();

  // Verify ownership
  await requireAccountOwnership(accountId);

  const { data, error } = await supabase
    .from("Transaction")
    .select("id")
    .eq("accountId", accountId)
    .limit(1);

  if (error) {
    console.error("Supabase error checking transactions:", error);
    // If we can't check, assume there are transactions to be safe
    return true;
  }

  return (data?.length ?? 0) > 0;
}

export async function deleteAccount(id: string, transferToAccountId?: string) {
    const supabase = await createServerClient();

  // Verify ownership before deleting
  await requireAccountOwnership(id);

  // If a transfer account is provided, transfer transactions first
  if (transferToAccountId) {
    await transferAccountTransactions(id, transferToAccountId);
  } else {
    // Check if account has transactions
    const hasTransactions = await accountHasTransactions(id);
    if (hasTransactions) {
      throw new Error("Account has associated transactions. Please select a destination account to transfer them to.");
    }
  }

  const { error } = await supabase.from("Account").delete().eq("id", id);

  if (error) {
    console.error("Supabase error deleting account:", error);
    throw new Error(`Failed to delete account: ${error.message || JSON.stringify(error)}`);
  }

  // Invalidate cache to ensure dashboard shows updated data
  const { invalidateAccountCaches, invalidateTransactionCaches } = await import('@/lib/services/cache-manager');
  invalidateAccountCaches();
  invalidateTransactionCaches();
}
