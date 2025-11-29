import { createServerClient } from "@/src/infrastructure/database/supabase-server";

/**
 * Calculate next due date based on day of month
 * If the date this month has already passed, use the same day next month
 * This is a pure function that doesn't need to be a server action
 */
export function calculateNextDueDate(dueDayOfMonth: number): Date {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const currentDay = today.getDate();

  // Create date for this month's due date
  const thisMonthDueDate = new Date(currentYear, currentMonth, dueDayOfMonth);
  
  // If this month's due date has passed, use next month
  if (currentDay > dueDayOfMonth) {
    // Next month
    const nextMonth = currentMonth + 1;
    const nextYear = nextMonth > 11 ? currentYear + 1 : currentYear;
    const adjustedMonth = nextMonth > 11 ? 0 : nextMonth;
    
    // Handle edge case where day doesn't exist in next month (e.g., Feb 31)
    const daysInMonth = new Date(nextYear, adjustedMonth + 1, 0).getDate();
    const safeDay = Math.min(dueDayOfMonth, daysInMonth);
    
    return new Date(nextYear, adjustedMonth, safeDay);
  }

  // This month's due date hasn't passed yet
  // Handle edge case where day doesn't exist in current month
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const safeDay = Math.min(dueDayOfMonth, daysInMonth);
  
  return new Date(currentYear, currentMonth, safeDay);
}

/**
 * Get active credit card debt for an account
 * Returns the most recent active debt if multiple exist
 */
export async function getActiveCreditCardDebt(accountId: string) {
  const supabase = await createServerClient();

  const { data: debts, error } = await supabase
    .from("Debt")
    .select("*")
    .eq("accountId", accountId)
    .eq("loanType", "credit_card")
    .eq("status", "active")
    .order("createdAt", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Error fetching active credit card debt:", error);
    return null;
  }

  return debts && debts.length > 0 ? debts[0] : null;
}

/**
 * Check if an account is a credit card account
 */
export async function isCreditCardAccount(accountId: string): Promise<boolean> {
  const supabase = await createServerClient();

  const { data: account, error } = await supabase
    .from("Account")
    .select("type")
    .eq("id", accountId)
    .single();

  if (error || !account) {
    return false;
  }

  return account.type === "credit";
}

/**
 * Check if account has valid billing setup (is credit card with dueDayOfMonth defined)
 */
export async function hasValidBillingSetup(accountId: string): Promise<boolean> {
  const supabase = await createServerClient();

  const { data: account, error } = await supabase
    .from("Account")
    .select("type, dueDayOfMonth")
    .eq("id", accountId)
    .single();

  if (error || !account) {
    return false;
  }

  return account.type === "credit" && account.dueDayOfMonth !== null && account.dueDayOfMonth !== undefined;
}

/**
 * Get account with credit card information
 */
export async function getCreditCardAccount(accountId: string) {
  const supabase = await createServerClient();

  const { data: account, error } = await supabase
    .from("Account")
    .select("*")
    .eq("id", accountId)
    .single();

  if (error || !account) {
    return null;
  }

  return account;
}

