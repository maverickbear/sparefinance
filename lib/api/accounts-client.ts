"use client";

import { supabase } from "@/lib/supabase";
import { getTransactionAmount } from "@/lib/utils/transaction-encryption";
import { AccountFormData } from "@/lib/validations/account";
import { getCurrentTimestamp, formatTimestamp } from "@/lib/utils/timestamp";

export interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  creditLimit?: number | null;
  initialBalance?: number | null;
  householdName?: string | null;
  ownerIds?: string[];
}

/**
 * Get all accounts for the current user
 * @param options - Optional configuration
 * @param options.includeInvestmentBalances - Whether to calculate investment account balances from holdings (default: true)
 *                                            Set to false to skip expensive holdings fetch when balances aren't needed
 */
export async function getAccountsClient(options?: { includeInvestmentBalances?: boolean }): Promise<Account[]> {
  const includeInvestmentBalances = options?.includeInvestmentBalances ?? true;
  
  // OPTIMIZED: Use server API route when investment balances aren't needed
  // This avoids fetching all transactions in the client, which can be very slow
  if (!includeInvestmentBalances) {
    try {
      const response = await fetch("/api/accounts?includeHoldings=false");
      if (response.ok) {
        const accounts = await response.json();
        // Filter out investment accounts or set their balance to 0 since we're not calculating it
        return accounts.map((acc: any) => ({
          ...acc,
          balance: acc.type === "investment" ? 0 : acc.balance,
        }));
      }
    } catch (error) {
      console.error("Error fetching accounts from API:", error);
      // Fall through to client-side implementation
    }
  }
  
  const { data: accounts, error } = await supabase
    .from("Account")
    .select("*")
    .order("name", { ascending: true });

  if (error || !accounts) {
    console.error("Error fetching accounts:", error);
    return [];
  }

  // Fetch all transactions up to today in one query to avoid N+1 queries
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

  // Calculate balances in memory
  const balances = new Map<string, number>();
  
  // Separate investment accounts from regular accounts
  const investmentAccounts = accounts.filter(acc => acc.type === "investment");
  const regularAccounts = accounts.filter(acc => acc.type !== "investment");
  
  // Initialize regular accounts with their initialBalance (or 0 if not set)
  regularAccounts.forEach((account) => {
    // Get initialBalance, handling both null and undefined
    const initialBalance = (account as any).initialBalance != null 
      ? (account as any).initialBalance 
      : 0;
    balances.set(account.id, initialBalance);
  });

  // Calculate balances from transactions (only past and today's transactions)
  // Only process transactions for non-investment accounts
  // Compare dates by year, month, day only to avoid timezone issues
  const todayDate = new Date(todayYear, todayMonth, todayDay);
  
  for (const tx of transactions || []) {
    // Skip transactions for investment accounts
    const account = accounts.find(acc => acc.id === tx.accountId);
    if (account?.type === "investment") {
      continue;
    }
    
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
    
    const currentBalance = balances.get(tx.accountId) || 0;
    
    // Decrypt amount if encrypted
    const decryptedAmount = getTransactionAmount(tx.amount);
    
    // Skip transaction if amount is invalid (null, NaN, or unreasonably large)
    // Note: In browser, encrypted amounts cannot be decrypted (no access to encryption key),
    // so we silently skip them. The server API should handle decryption before sending to client.
    if (decryptedAmount === null || isNaN(decryptedAmount) || !isFinite(decryptedAmount)) {
      // Only log warning if the amount looks like it should be decryptable but failed
      // (i.e., it's a long hex string indicating encrypted data)
      const isEncryptedData = typeof tx.amount === 'string' && 
        tx.amount.length >= 192 && 
        /^[0-9a-f]+$/i.test(tx.amount);
      
      // Only warn if it's NOT encrypted data (meaning it's a real error)
      // Encrypted data in browser is expected to fail decryption
      if (!isEncryptedData) {
        console.warn('Skipping transaction with invalid amount:', {
          accountId: tx.accountId,
          amount: tx.amount?.substring?.(0, 50) || tx.amount,
          decryptedAmount,
        });
      }
      continue;
    }
    
    // Handle transfers separately - they move money between accounts
    if (tx.type === "transfer") {
      // For outgoing transfer (has transferToId), subtract from source account
      if ((tx as any).transferToId) {
        balances.set(tx.accountId, currentBalance - Math.abs(decryptedAmount));
      }
      // For incoming transfer (has transferFromId), add to destination account
      // Note: The incoming transfer will be processed separately with its own accountId
      if ((tx as any).transferFromId) {
        balances.set(tx.accountId, currentBalance + decryptedAmount);
      }
    } else if (tx.type === "income") {
      balances.set(tx.accountId, currentBalance + decryptedAmount);
    } else if (tx.type === "expense") {
      balances.set(tx.accountId, currentBalance - Math.abs(decryptedAmount));
    }
  }

  // Handle investment accounts separately
  if (investmentAccounts.length > 0) {
    const investmentAccountIds: string[] = investmentAccounts.map((acc: any) => acc.id);
    
    // 1. First, try to get values from InvestmentAccount
    const { data: investmentAccountData } = await supabase
      .from("InvestmentAccount")
      .select("accountId, totalEquity, marketValue, cash")
      .in("accountId", investmentAccountIds)
      .not("accountId", "is", null);
    
    if (investmentAccountData) {
      for (const investmentAccount of investmentAccountData) {
        if (investmentAccount.accountId) {
          // Convert numeric values to numbers (they may come as strings from Supabase)
          const totalEquity = investmentAccount.totalEquity != null 
            ? Number(investmentAccount.totalEquity) 
            : null;
          const marketValue = investmentAccount.marketValue != null 
            ? Number(investmentAccount.marketValue) 
            : 0;
          const cash = investmentAccount.cash != null 
            ? Number(investmentAccount.cash) 
            : 0;
          
          // Use totalEquity if available, otherwise use marketValue + cash
          const accountValue = totalEquity ?? (marketValue + cash);
          balances.set(investmentAccount.accountId, accountValue);
        }
      }
    }
    
    // 2. For accounts without InvestmentAccount data, try AccountInvestmentValue (simple investments)
    const accountsWithoutInvestmentAccount = investmentAccountIds.filter(
      (accountId: string) => !balances.has(accountId)
    );
    
    if (accountsWithoutInvestmentAccount.length > 0) {
      const { data: investmentValues } = await supabase
        .from("AccountInvestmentValue")
        .select("accountId, totalValue")
        .in("accountId", accountsWithoutInvestmentAccount);
      
      if (investmentValues) {
        for (const investmentValue of investmentValues) {
          // Convert numeric value to number (may come as string from Supabase)
          const totalValue = investmentValue.totalValue != null 
            ? Number(investmentValue.totalValue) 
            : 0;
          balances.set(investmentValue.accountId, totalValue);
        }
      }
    }
    
    // 3. For accounts without InvestmentAccount or AccountInvestmentValue, calculate from holdings
    // OPTIMIZED: Only fetch holdings if we actually have accounts that need it AND if includeInvestmentBalances is true
    // This avoids expensive API calls when investment balances aren't needed (e.g., in Transactions page)
    const accountsWithoutValue = investmentAccountIds.filter(
      (accountId: string) => !balances.has(accountId)
    );
    
    if (accountsWithoutValue.length > 0 && includeInvestmentBalances) {
      try {
        // OPTIMIZED: Use a more efficient approach - only fetch if we have accounts that need it
        // Note: This is a fallback for accounts without InvestmentAccount or AccountInvestmentValue
        // In most cases, accounts will have values from steps 1 or 2, so this call is rarely needed
        // OPTIMIZED: Skip this expensive call if investment balances aren't needed
        const holdingsResponse = await fetch("/api/portfolio/holdings", { 
          cache: 'no-store',
          // Add a signal to allow cancellation if component unmounts
        });
        if (holdingsResponse.ok) {
          const holdings = await holdingsResponse.json();
          
          // Calculate value for each account based on holdings
          for (const accountId of accountsWithoutValue) {
            const accountHoldings = holdings.filter((h: any) => h.accountId === accountId);
            const accountValue = accountHoldings.reduce((sum: number, h: any) => {
              return sum + (h.marketValue || 0);
            }, 0);
            
            if (accountValue > 0) {
              balances.set(accountId, accountValue);
            }
          }
        }
      } catch (error) {
        // Silently handle errors - this is a fallback mechanism
        // If holdings fetch fails, accounts will just have 0 balance
        if (process.env.NODE_ENV === 'development') {
          console.warn("Could not fetch holdings for account values (this is expected if accounts have no holdings):", error);
        }
        // Continue without failing - will set to 0 below
      }
    } else if (accountsWithoutValue.length > 0 && !includeInvestmentBalances) {
      // Skip holdings fetch but log in development for debugging
      if (process.env.NODE_ENV === 'development') {
        console.log(`[getAccountsClient] Skipping holdings fetch for ${accountsWithoutValue.length} investment accounts (includeInvestmentBalances=false)`);
      }
    }
    
    // 4. For accounts without any value, set to 0
    investmentAccounts.forEach((account: any) => {
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

  accounts.forEach((acc) => {
    if (acc.userId) {
      allOwnerIds.add(acc.userId);
    }
  });

  // Fetch owner names and avatars
  const { data: owners } = await supabase
    .from("User")
    .select("id, name, avatarUrl")
    .in("id", Array.from(allOwnerIds));

  // Create a map: ownerId -> ownerName (first name only)
  const ownerNameMap = new Map<string, string>();
  // Create a map: ownerId -> ownerAvatarUrl
  const ownerAvatarMap = new Map<string, string | null>();
  owners?.forEach((owner) => {
    if (owner.id && owner.name) {
      const firstName = owner.name.split(' ')[0];
      ownerNameMap.set(owner.id, firstName);
    }
    if (owner.id) {
      ownerAvatarMap.set(owner.id, owner.avatarUrl || null);
    }
  });

  // Combine accounts with their balances and household names
  const accountsWithBalances = accounts.map((account) => {
    const ownerIds = accountOwnersMap.get(account.id) || 
      (account.userId ? [account.userId] : []);
    
    const householdNames = ownerIds
      .map(ownerId => ownerNameMap.get(ownerId))
      .filter(Boolean) as string[];
    
    const householdName = householdNames.length > 0 
      ? householdNames.join(", ") 
      : null;

    // Get owner avatars (first owner's avatar, or null if none)
    const ownerAvatarUrls = ownerIds
      .map(ownerId => ownerAvatarMap.get(ownerId))
      .filter(Boolean) as (string | null)[];
    const ownerAvatarUrl = ownerAvatarUrls.length > 0 ? ownerAvatarUrls[0] : null;
    
    // Get owner names for avatar fallback
    const ownerNames = ownerIds
      .map(ownerId => {
        const firstName = ownerNameMap.get(ownerId);
        return firstName || null;
      })
      .filter(Boolean) as string[];
    const ownerName = ownerNames.length > 0 ? ownerNames[0] : null;

    // Get calculated balance, or use initialBalance if balance is 0 and initialBalance exists
    const calculatedBalance = balances.get(account.id) || 0;
    const initialBalance = (account as any).initialBalance ?? 0;
    // Use initialBalance if calculated balance is 0 and initialBalance is set
    const finalBalance = calculatedBalance === 0 && initialBalance !== 0 
      ? initialBalance 
      : calculatedBalance;

    return {
      ...account,
      balance: finalBalance,
      initialBalance: initialBalance, // Ensure initialBalance is included in response
      householdName,
      ownerIds,
      ownerAvatarUrl,
      ownerName,
      isConnected: (account as any).isConnected || false,
      lastSyncedAt: (account as any).lastSyncedAt || null,
      institutionName: null, // Will be fetched separately if needed
      institutionLogo: null, // Will be fetched separately if needed
    };
  });

  // Fetch institution names and logos from PlaidConnection for connected accounts
  const connectedAccounts = accountsWithBalances.filter(acc => acc.plaidItemId);
  if (connectedAccounts.length > 0) {
    const plaidItemIds = connectedAccounts.map(acc => acc.plaidItemId).filter(Boolean) as string[];
    
    const { data: plaidConnections } = await supabase
      .from('PlaidConnection')
      .select('itemId, institutionName, institutionLogo')
      .in('itemId', plaidItemIds);

    if (plaidConnections) {
      const connectionMap = new Map(
        plaidConnections.map(conn => [conn.itemId, conn])
      );

      accountsWithBalances.forEach(account => {
        if (account.plaidItemId) {
          const connection = connectionMap.get(account.plaidItemId);
          if (connection) {
            (account as any).institutionName = connection.institutionName || null;
            (account as any).institutionLogo = connection.institutionLogo || null;
          }
        }
      });
    }
  }

  return accountsWithBalances;
}

/**
 * Create a new account
 */
export async function createAccountClient(data: AccountFormData): Promise<Account> {
  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  // Generate UUID for the account
  const id = crypto.randomUUID();
  const now = formatTimestamp(new Date());

  // Determine owner IDs: use provided ownerIds or default to current user
  const ownerIds = data.ownerIds && data.ownerIds.length > 0 
    ? data.ownerIds 
    : [user.id];

  // Get active household ID
  const { getActiveHouseholdId } = await import("@/lib/utils/household");
  const householdId = await getActiveHouseholdId(user.id);
  if (!householdId) {
    throw new Error("No active household found. Please contact support.");
  }

  const { data: account, error } = await supabase
    .from("Account")
    .insert({
      id,
      name: data.name,
      type: data.type,
      creditLimit: data.type === "credit" ? data.creditLimit : null,
      initialBalance: (data.type === "checking" || data.type === "savings") ? (data.initialBalance ?? 0) : null,
      dueDayOfMonth: data.type === "credit" ? (data.dueDayOfMonth ?? null) : null,
      currencyCode: data.currencyCode || 'USD', // Default to USD if not provided
      userId: user.id,
      householdId: householdId, // Add householdId for household-based architecture
      createdAt: now,
      updatedAt: now,
    })
    .select()
    .single();

  if (error) {
    console.error("Supabase error creating account:", error);
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

    const { error: ownersError } = await supabase
      .from("AccountOwner")
      .insert(accountOwners);

    if (ownersError) {
      console.error("Supabase error creating account owners:", ownersError);
      throw new Error(`Failed to create account owners: ${ownersError.message || JSON.stringify(ownersError)}`);
    }
  }

  return { ...account, balance: (account as any).initialBalance ?? 0, ownerIds };
}

/**
 * Update an account
 */
export async function updateAccountClient(id: string, data: Partial<AccountFormData>): Promise<Account> {
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
    updateData.initialBalance = data.initialBalance;
  }
  
  // Handle currencyCode: update if provided, otherwise preserve existing value
  if (data.currencyCode !== undefined) {
    updateData.currencyCode = data.currencyCode || 'USD'; // Default to USD if explicitly set to null/empty
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

  return { ...account, balance: (account as any).balance ?? 0 };
}

/**
 * Check if an account has associated transactions
 */
export async function accountHasTransactionsClient(accountId: string): Promise<boolean> {
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

/**
 * Transfer all transactions from one account to another
 */
export async function transferAccountTransactionsClient(
  fromAccountId: string,
  toAccountId: string
): Promise<{ transferred: number }> {
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

  return { transferred: transactions.length };
}

/**
 * Delete an account
 */
export async function deleteAccountClient(id: string, transferToAccountId?: string): Promise<void> {
  // Use API route to ensure server-side validation and transaction transfer
  const response = await fetch(`/api/accounts/${id}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ transferToAccountId }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to delete account");
  }
}

