/**
 * Category Color Mapping
 * Maps category names to specific colors for consistent visualization
 * across the application.
 */

// Extended color palette with good contrast and visual distinction
const COLOR_PALETTE = [
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // purple
  "#06b6d4", // cyan
  "#f97316", // orange
  "#ec4899", // pink
  "#14b8a6", // teal
  "#6366f1", // indigo
  "#a855f7", // violet
  "#84cc16", // lime
  "#f43f5e", // rose
  "#0ea5e9", // sky
  "#22c55e", // emerald
  "#eab308", // yellow
  "#6b7280", // gray
  "#374151", // dark gray
  "#9ca3af", // gray
  "#d1d5db", // light gray
];

/**
 * Category color mapping
 * Maps category names (case-insensitive) to specific hex colors
 */
const CATEGORY_COLORS: Record<string, string> = {
  // Housing
  "Rent": "#3b82f6", // blue
  "Rent / Mortgage": "#3b82f6", // blue
  "Utilities": "#06b6d4", // cyan
  "Home Maintenance": "#10b981", // green
  "Home Insurance": "#0ea5e9", // sky

  // Transportation
  "Vehicle": "#f97316", // orange
  "Public Transit": "#6366f1", // indigo

  // Food
  "Groceries": "#22c55e", // emerald
  "Restaurants": "#f59e0b", // amber
  "Snacks & Drinks": "#eab308", // yellow

  // Health & Personal
  "Medical": "#ef4444", // red
  "Healthcare": "#ef4444", // red
  "Personal Care": "#ec4899", // pink
  "Fitness": "#10b981", // green

  // Family & Kids
  "Baby Essentials": "#f43f5e", // rose
  "Child/Baby": "#f43f5e", // rose
  "Education": "#8b5cf6", // purple
  "Activities": "#a855f7", // violet

  // Insurance
  "Insurance Payments": "#0ea5e9", // sky

  // Debts
  "Loans": "#ef4444", // red
  "Credit Cards": "#f97316", // orange
  "Other Debts": "#6b7280", // gray

  // Shopping
  "Clothing": "#ec4899", // pink
  "Electronics": "#6366f1", // indigo
  "Home & Lifestyle": "#14b8a6", // teal

  // Entertainment & Leisure
  "Streaming": "#8b5cf6", // purple
  "Gaming": "#a855f7", // violet
  "Events": "#f59e0b", // amber
  "Travel": "#06b6d4", // cyan

  // Education & Work
  "Courses & Certificates": "#8b5cf6", // purple
  "Books": "#6366f1", // indigo
  "Software & Tools": "#3b82f6", // blue

  // Pets
  "Pet Care": "#14b8a6", // teal

  // Gifts & Donations
  "Gifts": "#ec4899", // pink
  "Donations": "#22c55e", // emerald

  // Business Expenses
  "Home Office": "#3b82f6", // blue
  "Software": "#6366f1", // indigo
  "Professional Services": "#06b6d4", // cyan
  "Marketing": "#f59e0b", // amber
  "Office": "#6b7280", // gray

  // Subscriptions
  "Subscriptions": "#8b5cf6", // purple

  // Savings
  "Emergency Fund": "#22c55e", // emerald
  "RRSP": "#10b981", // green
  "FHSA": "#14b8a6", // teal
  "TFSA": "#0ea5e9", // sky

  // Investments
  "Stocks": "#3b82f6", // blue
  "Crypto": "#f97316", // orange
  "Investment Income": "#10b981", // green
  "Rental Income": "#06b6d4", // cyan

  // Income
  "Salary & Wages": "#22c55e", // emerald
  "Extra Compensation": "#eab308", // yellow
  "Business Income": "#3b82f6", // blue
  "Benefits": "#0ea5e9", // sky
  "Gig Work": "#f59e0b", // amber
  "Sales": "#10b981", // green
  "Content Creation": "#8b5cf6", // purple
  "Family Support": "#ec4899", // pink
  "Reimbursements": "#14b8a6", // teal

  // Misc
  "Bank Fees": "#6b7280", // gray
  "Overdraft": "#ef4444", // red
  "Unexpected": "#f97316", // orange
  "Uncategorized": "#9ca3af", // gray
  "Other": "#9ca3af", // gray
};

/**
 * Get a consistent color for a category name
 * @param categoryName - The name of the category
 * @returns A hex color code
 */
export function getCategoryColor(categoryName: string | null | undefined): string {
  if (!categoryName) {
    return COLOR_PALETTE[COLOR_PALETTE.length - 1]; // Return gray for null/undefined
  }

  // Normalize category name: trim, lowercase for lookup
  const normalized = categoryName.trim();
  const lookupKey = normalized;

  // Check exact match first
  if (CATEGORY_COLORS[lookupKey]) {
    return CATEGORY_COLORS[lookupKey];
  }

  // Check case-insensitive match
  const lowerKey = Object.keys(CATEGORY_COLORS).find(
    (key) => key.toLowerCase() === normalized.toLowerCase()
  );
  if (lowerKey) {
    return CATEGORY_COLORS[lowerKey];
  }

  // Fallback: use hash function for consistent color assignment
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = normalized.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLOR_PALETTE.length;
  return COLOR_PALETTE[index];
}

/**
 * Get all available category colors
 * @returns Array of hex color codes
 */
export function getCategoryColorPalette(): string[] {
  return [...COLOR_PALETTE];
}

/**
 * Get color for a category by ID (requires fetching category name)
 * This is a helper for when you only have the category ID
 * @param categoryId - The ID of the category
 * @param categoryName - The name of the category (if available)
 * @returns A hex color code
 */
export function getCategoryColorById(
  categoryId: string | null | undefined,
  categoryName?: string | null
): string {
  if (categoryName) {
    return getCategoryColor(categoryName);
  }
  // If no name provided, use ID as fallback
  return getCategoryColor(categoryId || undefined);
}

