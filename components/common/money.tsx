/**
 * Formats a monetary amount as currency (CAD)
 * Handles edge cases: undefined, null, NaN, and ensures 0 displays as $0.00
 * 
 * @param amount - The amount to format (can be number, string, null, or undefined)
 * @returns Formatted currency string (e.g., "$0.00", "$1,234.56")
 */
export function formatMoney(amount: number | string | null | undefined): string {
  // Handle null, undefined, or empty string
  if (amount == null || amount === '') {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(0);
  }

  // Convert to number if it's a string
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : Number(amount);

  // Handle NaN or invalid numbers
  if (isNaN(numAmount) || !isFinite(numAmount)) {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(0);
  }

  // Format the valid number
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numAmount);
}

export function Money({ amount }: { amount: number }) {
  return <span>{formatMoney(amount)}</span>;
}

/**
 * Formats a monetary amount in compact notation (1K, 1M, etc.)
 * Useful for displaying large numbers in a more readable format
 * 
 * @param amount - The amount to format (can be number, string, null, or undefined)
 * @param options - Optional configuration
 * @returns Formatted currency string (e.g., "$1.2K", "$1.5M", "$2.3B")
 */
export function formatMoneyCompact(
  amount: number | string | null | undefined,
  options?: {
    showDecimals?: boolean; // Show decimals for compact format (default: true)
    threshold?: number; // Only use compact format above this value (default: 1000)
  }
): string {
  const { showDecimals = true, threshold = 1000 } = options || {};

  // Handle null, undefined, or empty string
  if (amount == null || amount === '') {
    return formatMoney(0);
  }

  // Convert to number if it's a string
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : Number(amount);

  // Handle NaN or invalid numbers
  if (isNaN(numAmount) || !isFinite(numAmount)) {
    return formatMoney(0);
  }

  const absAmount = Math.abs(numAmount);
  const sign = numAmount < 0 ? '-' : '';

  // Only use compact format if above threshold
  if (absAmount < threshold) {
    return formatMoney(numAmount);
  }

  // Format in compact notation
  let compactValue: string;
  let suffix: string;

  if (absAmount >= 1_000_000_000) {
    // Billions
    compactValue = (absAmount / 1_000_000_000).toFixed(showDecimals ? 1 : 0);
    suffix = 'B';
  } else if (absAmount >= 1_000_000) {
    // Millions
    compactValue = (absAmount / 1_000_000).toFixed(showDecimals ? 1 : 0);
    suffix = 'M';
  } else if (absAmount >= 1_000) {
    // Thousands
    compactValue = (absAmount / 1_000).toFixed(showDecimals ? 1 : 0);
    suffix = 'K';
  } else {
    return formatMoney(numAmount);
  }

  // Remove trailing .0 if not showing decimals
  if (!showDecimals) {
    compactValue = compactValue.replace(/\.0$/, '');
  } else {
    // Remove trailing zeros after decimal point
    compactValue = compactValue.replace(/\.?0+$/, '');
  }

  return `${sign}$${compactValue}${suffix}`;
}

