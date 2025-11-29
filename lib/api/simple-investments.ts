"use server";

import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { formatTimestamp } from "@/src/infrastructure/utils/timestamp";

export interface SimpleInvestmentEntry {
  id: string;
  accountId: string;
  date: string;
  type: "contribution" | "dividend" | "interest" | "initial";
  amount: number;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccountInvestmentValue {
  id: string;
  accountId: string;
  totalValue: number;
  updatedAt: string;
}

export async function getSimpleInvestmentEntries(accountId?: string) {
    const supabase = await createServerClient();

  let query = supabase
    .from("SimpleInvestmentEntry")
    .select("*")
    .order("date", { ascending: false });

  if (accountId) {
    query = query.eq("accountId", accountId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching simple investment entries:", error);
    return [];
  }

  return (data || []) as SimpleInvestmentEntry[];
}

export async function createSimpleInvestmentEntry(data: {
  accountId: string;
  date: Date;
  type: "contribution" | "dividend" | "interest" | "initial";
  amount: number;
  description?: string;
}) {
    const supabase = await createServerClient();

  const id = crypto.randomUUID();
  const date = data.date instanceof Date ? data.date : new Date(data.date);
  const entryDate = formatTimestamp(date);
  const now = formatTimestamp(new Date());

  const { data: entry, error } = await supabase
    .from("SimpleInvestmentEntry")
    .insert({
      id,
      accountId: data.accountId,
      date: entryDate,
      type: data.type,
      amount: data.amount,
      description: data.description || null,
      createdAt: now,
      updatedAt: now,
    })
    .select()
    .single();

  if (error) {
    console.error("Supabase error creating simple investment entry:", error);
    throw new Error(
      `Failed to create investment entry: ${error.message || JSON.stringify(error)}`
    );
  }

  return entry;
}

export async function getAccountInvestmentValue(accountId: string) {
    const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("AccountInvestmentValue")
    .select("*")
    .eq("accountId", accountId)
    .single();

  if (error) {
    // If not found, return null (no value set yet)
    if (error.code === "PGRST116") {
      return null;
    }
    console.error("Error fetching account investment value:", error);
    return null;
  }

  return data as AccountInvestmentValue | null;
}

export async function upsertAccountInvestmentValue(data: {
  accountId: string;
  totalValue: number;
}) {
    const supabase = await createServerClient();

  const now = formatTimestamp(new Date());

  // Check if value exists
  const existing = await getAccountInvestmentValue(data.accountId);

  if (existing) {
    // Update existing
    const { data: updated, error } = await supabase
      .from("AccountInvestmentValue")
      .update({
        totalValue: data.totalValue,
        updatedAt: now,
      })
      .eq("accountId", data.accountId)
      .select()
      .single();

    if (error) {
      console.error("Supabase error updating account investment value:", error);
      throw new Error(
        `Failed to update investment value: ${error.message || JSON.stringify(error)}`
      );
    }

    return updated;
  } else {
    // Create new
    const id = crypto.randomUUID();
    const { data: created, error } = await supabase
      .from("AccountInvestmentValue")
      .insert({
        id,
        accountId: data.accountId,
        totalValue: data.totalValue,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase error creating account investment value:", error);
      throw new Error(
        `Failed to create investment value: ${error.message || JSON.stringify(error)}`
      );
    }

    return created;
  }
}

export async function getTotalInvestmentsValue() {
    const supabase = await createServerClient();

  // Get all investment accounts (type = "investment")
  const { data: investmentAccounts, error: accountsError } = await supabase
    .from("Account")
    .select("id")
    .eq("type", "investment");

  if (accountsError || !investmentAccounts || investmentAccounts.length === 0) {
    return 0;
  }

  const accountIds = investmentAccounts.map((acc) => acc.id);

  // Get stored values for these accounts
  const { data: storedValues, error: valuesError } = await supabase
    .from("AccountInvestmentValue")
    .select("accountId, totalValue")
    .in("accountId", accountIds);

  // Get all entries for these accounts
  const { data: entries, error: entriesError } = await supabase
    .from("SimpleInvestmentEntry")
    .select("accountId, type, amount")
    .in("accountId", accountIds);

  // Calculate total value for each account
  let totalValue = 0;

  for (const account of investmentAccounts) {
    const storedValue = storedValues?.find((v) => v.accountId === account.id);
    
    if (storedValue) {
      // Use stored value if available
      totalValue += storedValue.totalValue;
    } else {
      // Calculate from entries if no stored value
      const accountEntries = entries?.filter((e) => e.accountId === account.id) || [];
      const accountTotal = accountEntries.reduce((sum, entry) => {
        // All entry types contribute to the total value
        if (entry.type === "initial" || entry.type === "contribution") {
          return sum + entry.amount;
        } else if (entry.type === "dividend" || entry.type === "interest") {
          return sum + entry.amount;
        }
        return sum;
      }, 0);
      totalValue += accountTotal;
    }
  }

  return totalValue;
}

