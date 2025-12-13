"use server";

import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { formatDateStart } from "@/src/infrastructure/utils/timestamp";
import { normalizeDescription } from "@/src/infrastructure/utils/transaction-encryption";

export type ConfidenceLevel = "high" | "medium" | "low" | "none";

export interface CategorySuggestion {
  categoryId: string;
  subcategoryId: string | null;
  confidence: ConfidenceLevel;
  matchCount: number;
  matchType: "description_and_amount" | "description_only";
}

// normalizeDescription is now imported from transaction-encryption.ts for consistency

/**
 * Suggest category based on user's transaction history
 * 
 * Criteria for high confidence (auto-categorize):
 * - Same normalized description + same exact amount: 3+ occurrences
 * - Same normalized description: 5+ occurrences with same category
 * 
 * Criteria for medium confidence (suggest):
 * - Same normalized description + same exact amount: 2 occurrences
 * - Same normalized description: 3-4 occurrences with same category
 * 
 * @param userId - User ID to analyze history for
 * @param description - Transaction description
 * @param amount - Transaction amount
 * @param type - Transaction type (expense/income)
 * @returns Category suggestion with confidence level, or null if no match
 */
/**
 * Update analytics.categoryLearning table when user confirms a category
 * 
 * @deprecated This function is deprecated. Category learning now uses direct transaction queries.
 * The analytics_category_learning table is no longer used for category suggestions.
 * This function is kept for backward compatibility but does nothing.
 * 
 * SIMPLIFIED: Removed dependency on analytics_category_learning table.
 * Category suggestions now come directly from transaction history (simpler and more reliable).
 */
export async function updateCategoryLearning(
  userId: string,
  normalizedDescription: string,
  type: string,
  categoryId: string,
  subcategoryId: string | null,
  amount: number
): Promise<void> {
  // No-op: Category learning now uses direct transaction queries
  // No need to maintain a separate analytics table
  return;
}

/**
 * Suggest category based on user's transaction history
 * 
 * SIMPLIFIED: Now uses direct transaction queries instead of analytics_category_learning table.
 * This is simpler, more reliable, and always up-to-date.
 * 
 * Criteria for high confidence (auto-categorize):
 * - Same normalized description + same exact amount: 3+ occurrences
 * - Same normalized description: 5+ occurrences with same category
 * 
 * Criteria for medium confidence (suggest):
 * - Same normalized description + same exact amount: 2 occurrences
 * - Same normalized description: 3-4 occurrences with same category
 * 
 * @param userId - User ID to analyze history for
 * @param description - Transaction description
 * @param amount - Transaction amount
 * @param type - Transaction type (expense/income)
 * @returns Category suggestion with confidence level, or null if no match
 */
export async function suggestCategory(
  userId: string,
  description: string,
  amount: number,
  type: string
): Promise<CategorySuggestion | null> {
  if (!description || !userId) {
    return null;
  }

  const normalizedDesc = normalizeDescription(description);
  
  // Use direct transaction query (simpler and more reliable)
  return await suggestCategoryFromTransactions(userId, description, amount, type, normalizedDesc);
}

/**
 * Suggest category from transaction history
 * SIMPLIFIED: This is now the primary method (no longer a fallback).
 * Scans 12 months of transactions to find category patterns.
 */
async function suggestCategoryFromTransactions(
  userId: string,
  description: string,
  amount: number,
  type: string,
  normalizedDesc: string
): Promise<CategorySuggestion | null> {
  const supabase = await createServerClient();
  
  // Look back 12 months for historical data
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 12);
  const startDateStr = formatDateStart(startDate);

  // Get all categorized transactions for this user in the last 12 months
  // Only consider transactions with the same type (expense/income)
  const { data: historicalTransactions, error } = await supabase
    .from("transactions")
    .select("id, description, amount, category_id, subcategory_id, type")
    .eq("user_id", userId)
    .eq("type", type)
    .not("category_id", "is", null)
    .gte("date", startDateStr)
    .order("date", { ascending: false });

  if (error) {
    console.error("Error fetching historical transactions for category learning:", error);
    return null;
  }

  if (!historicalTransactions || historicalTransactions.length === 0) {
    return null;
  }

  // Group matches by category
  const categoryMatches = new Map<
    string,
    {
      categoryId: string;
      subcategoryId: string | null;
      descriptionAndAmount: number;
      descriptionOnly: number;
    }
  >();

  // Analyze matches
  for (const tx of historicalTransactions) {
    if (!tx.category_id || !tx.description) continue;

    const normalizedTxDesc = normalizeDescription(tx.description);
    const key = `${tx.category_id}-${tx.subcategory_id || "null"}`;

    if (!categoryMatches.has(key)) {
      categoryMatches.set(key, {
        categoryId: tx.category_id,
        subcategoryId: tx.subcategory_id,
        descriptionAndAmount: 0,
        descriptionOnly: 0,
      });
    }

    const match = categoryMatches.get(key)!;

    // Check for exact description match
    if (normalizedTxDesc === normalizedDesc) {
      // Check if amount also matches (within 0.01 tolerance for floating point)
      // Note: amounts are encrypted, so we need to decrypt first
      const txAmount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
      if (Math.abs(txAmount - amount) < 0.01) {
        match.descriptionAndAmount++;
      } else {
        match.descriptionOnly++;
      }
    }
  }

  // Find best match
  let bestMatch: CategorySuggestion | null = null;
  let bestScore = 0;

  for (const [key, match] of categoryMatches.entries()) {
    // Prioritize description + amount matches
    if (match.descriptionAndAmount >= 3) {
      // High confidence: auto-categorize
      return {
        categoryId: match.categoryId,
        subcategoryId: match.subcategoryId,
        confidence: "high",
        matchCount: match.descriptionAndAmount,
        matchType: "description_and_amount",
      };
    }

    if (match.descriptionOnly >= 5) {
      // High confidence: auto-categorize
      return {
        categoryId: match.categoryId,
        subcategoryId: match.subcategoryId,
        confidence: "high",
        matchCount: match.descriptionOnly,
        matchType: "description_only",
      };
    }

    // Calculate score for medium/low confidence suggestions
    const score = match.descriptionAndAmount * 2 + match.descriptionOnly;

    if (score > bestScore) {
      bestScore = score;
      
      if (match.descriptionAndAmount >= 2 || match.descriptionOnly >= 3) {
        // Medium confidence: suggest
        bestMatch = {
          categoryId: match.categoryId,
          subcategoryId: match.subcategoryId,
          confidence: "medium",
          matchCount: match.descriptionAndAmount >= 2 ? match.descriptionAndAmount : match.descriptionOnly,
          matchType: match.descriptionAndAmount >= 2 ? "description_and_amount" : "description_only",
        };
      } else if (match.descriptionAndAmount >= 1 || match.descriptionOnly >= 1) {
        // Low confidence: still suggest but with lower priority
        bestMatch = {
          categoryId: match.categoryId,
          subcategoryId: match.subcategoryId,
          confidence: "low",
          matchCount: match.descriptionAndAmount >= 1 ? match.descriptionAndAmount : match.descriptionOnly,
          matchType: match.descriptionAndAmount >= 1 ? "description_and_amount" : "description_only",
        };
      }
    }
  }

  return bestMatch;
}

