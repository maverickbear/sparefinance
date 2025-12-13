/**
 * Transaction Type Suggester
 * Provides intelligent suggestions for mapping CSV transaction type values
 * Uses pattern matching and AI when available
 */

export type TransactionType = "expense" | "income" | "transfer";

interface PatternRule {
  keywords: string[];
  type: TransactionType;
  confidence: number; // 0-1
}

// Common patterns for transaction types
const PATTERN_RULES: PatternRule[] = [
  // Expense patterns
  {
    keywords: ["spend", "purchase", "payment", "debit", "charge", "withdrawal", "out", "expense", "cost", "fee"],
    type: "expense",
    confidence: 0.9,
  },
  {
    keywords: ["aft_out", "e_trfout", "trfout", "transfer_out", "withdraw"],
    type: "expense",
    confidence: 0.85,
  },
  // Income patterns
  {
    keywords: ["deposit", "credit", "income", "salary", "payroll", "interest", "dividend", "refund", "in", "receive"],
    type: "income",
    confidence: 0.9,
  },
  {
    keywords: ["e_trfin", "trfin", "transfer_in", "deposit"],
    type: "income",
    confidence: 0.85,
  },
  // Transfer patterns
  {
    keywords: ["transfer", "trf", "move", "send", "receive", "trfintf"],
    type: "transfer",
    confidence: 0.8,
  },
  {
    keywords: ["e_trfout", "e_trfin", "internal_transfer"],
    type: "transfer",
    confidence: 0.75,
  },
];

/**
 * Suggest transaction type based on pattern matching
 */
export function suggestTransactionType(value: string): TransactionType | null {
  if (!value || value.trim().length === 0) {
    return null;
  }

  const normalized = value.toLowerCase().trim();
  let bestMatch: { type: TransactionType; confidence: number } | null = null;

  for (const rule of PATTERN_RULES) {
    const matches = rule.keywords.filter((keyword) =>
      normalized.includes(keyword.toLowerCase())
    ).length;

    if (matches > 0) {
      const confidence = rule.confidence * (matches / rule.keywords.length);
      if (!bestMatch || confidence > bestMatch.confidence) {
        bestMatch = { type: rule.type, confidence };
      }
    }
  }

  // Only return suggestion if confidence is above threshold
  return bestMatch && bestMatch.confidence > 0.5 ? bestMatch.type : null;
}

/**
 * Learn from user mappings and store in localStorage
 */
const STORAGE_KEY = "spare_transaction_type_mappings";

export interface LearnedMapping {
  csvValue: string;
  mappedType: TransactionType;
  timestamp: number;
}

export function saveLearnedMapping(csvValue: string, mappedType: TransactionType) {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const mappings: LearnedMapping[] = stored ? JSON.parse(stored) : [];

    // Remove existing mapping for this value
    const filtered = mappings.filter((m) => m.csvValue !== csvValue);

    // Add new mapping
    filtered.push({
      csvValue,
      mappedType,
      timestamp: Date.now(),
    });

    // Keep only last 100 mappings
    const sorted = filtered.sort((a, b) => b.timestamp - a.timestamp);
    const recent = sorted.slice(0, 100);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(recent));
  } catch (error) {
    console.error("Error saving learned mapping:", error);
  }
}

export function getLearnedMapping(csvValue: string): TransactionType | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const mappings: LearnedMapping[] = JSON.parse(stored);
    const exactMatch = mappings.find((m) => m.csvValue === csvValue);
    if (exactMatch) {
      return exactMatch.mappedType;
    }

    // Try fuzzy match (case-insensitive)
    const normalized = csvValue.toLowerCase().trim();
    const fuzzyMatch = mappings.find(
      (m) => m.csvValue.toLowerCase().trim() === normalized
    );
    if (fuzzyMatch) {
      return fuzzyMatch.mappedType;
    }

    return null;
  } catch (error) {
    console.error("Error getting learned mapping:", error);
    return null;
  }
}

/**
 * Get suggestion with priority: learned mapping > pattern matching
 */
export function getSuggestion(csvValue: string): TransactionType | null {
  // First check learned mappings
  const learned = getLearnedMapping(csvValue);
  if (learned) {
    return learned;
  }

  // Fall back to pattern matching
  return suggestTransactionType(csvValue);
}

/**
 * Batch suggest for multiple values
 */
export function batchSuggest(values: string[]): Record<string, TransactionType> {
  const suggestions: Record<string, TransactionType> = {};

  for (const value of values) {
    const suggestion = getSuggestion(value);
    if (suggestion) {
      suggestions[value] = suggestion;
    }
  }

  return suggestions;
}
