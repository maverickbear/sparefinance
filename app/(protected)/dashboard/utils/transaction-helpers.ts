/**
 * Helper functions for transaction calculations in the dashboard
 */

/**
 * Safely parses a transaction amount, handling string, number, null, undefined, and encrypted values
 * @param amount - The amount value (can be string, number, null, or undefined)
 * @returns The parsed number, or 0 if invalid
 */
export function parseTransactionAmount(amount: any): number {
  if (amount == null || amount === '') {
    return 0;
  }

  // If it's already a number, return it (checking for NaN)
  if (typeof amount === 'number') {
    return isNaN(amount) || !isFinite(amount) ? 0 : amount;
  }

  // If it's a string, try to parse it
  if (typeof amount === 'string') {
    // Check if it looks like an encrypted value (starts with specific patterns)
    // Encrypted values typically don't parse to valid numbers
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || !isFinite(parsed)) {
      return 0;
    }
    return parsed;
  }

  // Try to convert to number as last resort
  const num = Number(amount);
  return isNaN(num) || !isFinite(num) ? 0 : num;
}

/**
 * Calculates total income from transactions
 * @param transactions - Array of transactions
 * @returns Total income amount
 */
export function calculateTotalIncome(transactions: any[]): number {
  return transactions
    .filter((t) => t && t.type === "income")
    .reduce((sum, t) => {
      return sum + parseTransactionAmount(t.amount);
    }, 0);
}

/**
 * Calculates total expenses from transactions
 * @param transactions - Array of transactions
 * @returns Total expenses amount (always positive)
 */
export function calculateTotalExpenses(transactions: any[]): number {
  return transactions
    .filter((t) => t && t.type === "expense")
    .reduce((sum, t) => {
      // For expenses, ensure we're using the absolute value
      const amount = parseTransactionAmount(t.amount);
      return sum + Math.abs(amount);
    }, 0);
}

/**
 * Calculates net amount (income - expenses) from transactions
 * @param transactions - Array of transactions
 * @returns Net amount (positive for surplus, negative for deficit)
 */
export function calculateNetAmount(transactions: any[]): number {
  const income = calculateTotalIncome(transactions);
  const expenses = calculateTotalExpenses(transactions);
  return income - expenses;
}

/**
 * Groups transactions by category and calculates totals
 * @param transactions - Array of transactions (should be filtered to expenses)
 * @returns Object with category names as keys and totals as values
 */
export function groupExpensesByCategory(transactions: any[]): Record<string, number> {
  return transactions
    .filter((t) => t && t.type === "expense")
    .reduce((acc, t) => {
      const categoryName = t.category?.name || "Other";
      const amount = parseTransactionAmount(t.amount);
      
      if (amount <= 0) return acc;

      if (!acc[categoryName]) {
        acc[categoryName] = 0;
      }
      acc[categoryName] += Math.abs(amount);
      return acc;
    }, {} as Record<string, number>);
}

