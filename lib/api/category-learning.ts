"use server";

import { createServerClient } from "@/lib/supabase-server";
import { formatDateStart } from "@/lib/utils/timestamp";
import { normalizeDescription } from "@/lib/utils/transaction-encryption";

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
 * Update category_learning table when user confirms a category
 * This function is idempotent and can be called multiple times safely
 */
export async function updateCategoryLearning(
  userId: string,
  normalizedDescription: string,
  type: string,
  categoryId: string,
  subcategoryId: string | null,
  amount: number
): Promise<void> {
  if (!normalizedDescription || !userId || !categoryId) {
    return;
  }

  const supabase = await createServerClient();
  
  // Check if we should increment description_and_amount_count or description_only_count
  // We need to check if there are other transactions with same description+amount
  // For now, we'll use a simple heuristic: if amount matches exactly, increment both
  // In practice, we'll track this more accurately in the learning table
  
  // Check if record exists
  const { data: existing } = await supabase
    .from('category_learning')
    .select('*')
    .eq('user_id', userId)
    .eq('normalized_description', normalizedDescription)
    .eq('type', type)
    .single();

  if (existing) {
    // Update existing record - increment appropriate counter
    // Check if amount matches to decide which counter to increment
    // For now, we'll check if there are other transactions with same description+amount
    // This is a simplified version - in production you might want to track this more accurately
    
    // Increment both counters for now (we can refine this later with better tracking)
    const { error: updateError } = await supabase
      .from('category_learning')
      .update({
        description_and_amount_count: (existing.description_and_amount_count || 0) + 1,
        description_only_count: (existing.description_only_count || 0) + 1,
        last_used_at: new Date().toISOString(),
        category_id: categoryId, // Update category in case it changed
        subcategory_id: subcategoryId,
      })
      .eq('user_id', userId)
      .eq('normalized_description', normalizedDescription)
      .eq('type', type);
    
    if (updateError) {
      console.error('Error updating category_learning:', updateError);
    }
  } else {
    // Insert new record
    const { error: insertError } = await supabase
      .from('category_learning')
      .insert({
        user_id: userId,
        normalized_description: normalizedDescription,
        type: type,
        category_id: categoryId,
        subcategory_id: subcategoryId,
        description_and_amount_count: 1,
        description_only_count: 1,
        last_used_at: new Date().toISOString(),
      });
    
    if (insertError) {
      console.error('Error inserting category_learning:', insertError);
    }
  }
}

export async function suggestCategory(
  userId: string,
  description: string,
  amount: number,
  type: string
): Promise<CategorySuggestion | null> {
  if (!description || !userId) {
    return null;
  }

  const supabase = await createServerClient();
  const normalizedDesc = normalizeDescription(description);

  // Query category_learning table instead of scanning 12 months of transactions
  const { data: learningData, error } = await supabase
    .from("category_learning")
    .select("category_id, subcategory_id, description_and_amount_count, description_only_count, last_used_at")
    .eq("user_id", userId)
    .eq("normalized_description", normalizedDesc)
    .eq("type", type)
    .order("last_used_at", { ascending: false });

  if (error) {
    console.error("Error fetching category learning data:", error);
    // Fallback to old method if table doesn't exist yet
    return await suggestCategoryLegacy(userId, description, amount, type, normalizedDesc);
  }

  if (!learningData || learningData.length === 0) {
    return null;
  }

  // Find best match from learning data
  let bestMatch: CategorySuggestion | null = null;
  let bestScore = 0;

  for (const learning of learningData) {
    const descAndAmount = learning.description_and_amount_count || 0;
    const descOnly = learning.description_only_count || 0;

    // Prioritize description + amount matches
    if (descAndAmount >= 3) {
      // High confidence: auto-categorize
      return {
        categoryId: learning.category_id,
        subcategoryId: learning.subcategory_id,
        confidence: "high",
        matchCount: descAndAmount,
        matchType: "description_and_amount",
      };
    }

    if (descOnly >= 5) {
      // High confidence: auto-categorize
      return {
        categoryId: learning.category_id,
        subcategoryId: learning.subcategory_id,
        confidence: "high",
        matchCount: descOnly,
        matchType: "description_only",
      };
    }

    // Calculate score for medium/low confidence suggestions
    const score = descAndAmount * 2 + descOnly;

    if (score > bestScore) {
      bestScore = score;
      
      if (descAndAmount >= 2 || descOnly >= 3) {
        // Medium confidence: suggest
        bestMatch = {
          categoryId: learning.category_id,
          subcategoryId: learning.subcategory_id,
          confidence: "medium",
          matchCount: descAndAmount >= 2 ? descAndAmount : descOnly,
          matchType: descAndAmount >= 2 ? "description_and_amount" : "description_only",
        };
      } else if (descAndAmount >= 1 || descOnly >= 1) {
        // Low confidence: still suggest but with lower priority
        bestMatch = {
          categoryId: learning.category_id,
          subcategoryId: learning.subcategory_id,
          confidence: "low",
          matchCount: descAndAmount >= 1 ? descAndAmount : descOnly,
          matchType: descAndAmount >= 1 ? "description_and_amount" : "description_only",
        };
      }
    }
  }

  return bestMatch;
}

/**
 * Legacy suggestCategory implementation (fallback if category_learning table doesn't exist)
 * Scans 12 months of transactions - slower but works as fallback
 */
async function suggestCategoryLegacy(
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
    .from("Transaction")
    .select("id, description, amount, categoryId, subcategoryId, type")
    .eq("userId", userId)
    .eq("type", type)
    .not("categoryId", "is", null)
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
    if (!tx.categoryId || !tx.description) continue;

    const normalizedTxDesc = normalizeDescription(tx.description);
    const key = `${tx.categoryId}-${tx.subcategoryId || "null"}`;

    if (!categoryMatches.has(key)) {
      categoryMatches.set(key, {
        categoryId: tx.categoryId,
        subcategoryId: tx.subcategoryId,
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

