"use server";

import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { logger } from "@/src/infrastructure/utils/logger";
import { getTransactionAmount, decryptDescription } from "@/src/infrastructure/utils/transaction-encryption";
import type { PlaidTransactionMetadata } from "@/lib/api/plaid/types";
import { getPlaidMetadataField } from "@/lib/api/plaid/utils";

export interface DetectedSubscription {
  merchantName: string;
  merchantEntityId?: string | null;
  logoUrl?: string | null;
  amount: number;
  frequency: "monthly" | "weekly" | "biweekly" | "semimonthly" | "daily";
  billingDay?: number;
  firstBillingDate: string;
  accountId: string;
  accountName: string;
  transactionCount: number;
  lastTransactionDate: string;
  confidence: "high" | "medium" | "low";
  description?: string | null;
  transactionIds: string[]; // IDs of transactions used for detection
}

/**
 * Known subscription services mapping
 * Maps merchant names (case-insensitive) to subscription service information
 */
const KNOWN_SUBSCRIPTION_SERVICES: Record<string, {
  name: string;
  logoUrl?: string;
  typicalFrequency: "monthly" | "weekly" | "biweekly" | "semimonthly" | "daily";
}> = {
  // Streaming Services
  "netflix": { name: "Netflix", typicalFrequency: "monthly" },
  "spotify": { name: "Spotify", typicalFrequency: "monthly" },
  "disney": { name: "Disney+", typicalFrequency: "monthly" },
  "disneyplus": { name: "Disney+", typicalFrequency: "monthly" },
  "hulu": { name: "Hulu", typicalFrequency: "monthly" },
  "hbo": { name: "HBO Max", typicalFrequency: "monthly" },
  "max": { name: "Max", typicalFrequency: "monthly" },
  "amazon prime": { name: "Amazon Prime", typicalFrequency: "monthly" },
  "prime video": { name: "Prime Video", typicalFrequency: "monthly" },
  "apple tv": { name: "Apple TV+", typicalFrequency: "monthly" },
  "appletv": { name: "Apple TV+", typicalFrequency: "monthly" },
  "paramount": { name: "Paramount+", typicalFrequency: "monthly" },
  "paramountplus": { name: "Paramount+", typicalFrequency: "monthly" },
  "peacock": { name: "Peacock", typicalFrequency: "monthly" },
  "youtube premium": { name: "YouTube Premium", typicalFrequency: "monthly" },
  "youtube tv": { name: "YouTube TV", typicalFrequency: "monthly" },
  
  // Music Services
  "apple music": { name: "Apple Music", typicalFrequency: "monthly" },
  "applemusic": { name: "Apple Music", typicalFrequency: "monthly" },
  "tidal": { name: "Tidal", typicalFrequency: "monthly" },
  "pandora": { name: "Pandora", typicalFrequency: "monthly" },
  "deezer": { name: "Deezer", typicalFrequency: "monthly" },
  
  // Software & Cloud Services
  "adobe": { name: "Adobe Creative Cloud", typicalFrequency: "monthly" },
  "microsoft 365": { name: "Microsoft 365", typicalFrequency: "monthly" },
  "office 365": { name: "Microsoft 365", typicalFrequency: "monthly" },
  "google workspace": { name: "Google Workspace", typicalFrequency: "monthly" },
  "g suite": { name: "Google Workspace", typicalFrequency: "monthly" },
  "dropbox": { name: "Dropbox", typicalFrequency: "monthly" },
  "icloud": { name: "iCloud", typicalFrequency: "monthly" },
  "onedrive": { name: "OneDrive", typicalFrequency: "monthly" },
  "notion": { name: "Notion", typicalFrequency: "monthly" },
  "figma": { name: "Figma", typicalFrequency: "monthly" },
  "slack": { name: "Slack", typicalFrequency: "monthly" },
  "zoom": { name: "Zoom", typicalFrequency: "monthly" },
  
  // Gaming
  "xbox": { name: "Xbox Game Pass", typicalFrequency: "monthly" },
  "playstation": { name: "PlayStation Plus", typicalFrequency: "monthly" },
  "nintendo": { name: "Nintendo Switch Online", typicalFrequency: "monthly" },
  "steam": { name: "Steam", typicalFrequency: "monthly" },
  
  // Fitness & Health
  "peloton": { name: "Peloton", typicalFrequency: "monthly" },
  "nike": { name: "Nike Training Club", typicalFrequency: "monthly" },
  "strava": { name: "Strava", typicalFrequency: "monthly" },
  "myfitnesspal": { name: "MyFitnessPal", typicalFrequency: "monthly" },
  
  // News & Media
  "new york times": { name: "The New York Times", typicalFrequency: "monthly" },
  "nytimes": { name: "The New York Times", typicalFrequency: "monthly" },
  "washington post": { name: "The Washington Post", typicalFrequency: "monthly" },
  "wall street journal": { name: "The Wall Street Journal", typicalFrequency: "monthly" },
  "wsj": { name: "The Wall Street Journal", typicalFrequency: "monthly" },
  
  // Other Services
  "amazon": { name: "Amazon", typicalFrequency: "monthly" },
  "costco": { name: "Costco", typicalFrequency: "monthly" },
  "audible": { name: "Audible", typicalFrequency: "monthly" },
  "kindle unlimited": { name: "Kindle Unlimited", typicalFrequency: "monthly" },
};

/**
 * Normalize merchant name for matching
 */
function normalizeMerchantName(name: string | null | undefined): string {
  if (!name) return "";
  return name.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "");
}

/**
 * Find known subscription service for a merchant name
 */
function findKnownSubscriptionService(merchantName: string): { name: string; logoUrl?: string; typicalFrequency: "monthly" | "weekly" | "biweekly" | "semimonthly" | "daily" } | null {
  const normalized = normalizeMerchantName(merchantName);
  
  // Direct match
  if (KNOWN_SUBSCRIPTION_SERVICES[normalized]) {
    return KNOWN_SUBSCRIPTION_SERVICES[normalized];
  }
  
  // Partial match (merchant name contains known service)
  for (const [key, service] of Object.entries(KNOWN_SUBSCRIPTION_SERVICES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return service;
    }
  }
  
  return null;
}

/**
 * Calculate frequency from transaction dates
 */
function calculateFrequency(dates: Date[]): "monthly" | "weekly" | "biweekly" | "semimonthly" | "daily" {
  if (dates.length < 2) return "monthly"; // Default to monthly
  
  // Sort dates
  const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());
  
  // Calculate average days between transactions
  let totalDays = 0;
  for (let i = 1; i < sortedDates.length; i++) {
    const diff = sortedDates[i].getTime() - sortedDates[i - 1].getTime();
    totalDays += diff / (1000 * 60 * 60 * 24); // Convert to days
  }
  const avgDays = totalDays / (sortedDates.length - 1);
  
  // Determine frequency based on average days
  if (avgDays <= 1.5) return "daily";
  if (avgDays <= 4) return "weekly";
  if (avgDays <= 10) return "biweekly";
  if (avgDays <= 18) return "semimonthly";
  return "monthly"; // Default to monthly for longer intervals
}

/**
 * Calculate billing day based on frequency and dates
 */
function calculateBillingDay(frequency: "monthly" | "weekly" | "biweekly" | "semimonthly" | "daily", dates: Date[]): number | undefined {
  if (dates.length === 0) return undefined;
  
  const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const firstDate = sortedDates[0];
  
  if (frequency === "monthly" || frequency === "semimonthly") {
    return firstDate.getDate(); // Day of month (1-31)
  } else if (frequency === "weekly" || frequency === "biweekly") {
    return firstDate.getDay(); // Day of week (0-6, Sunday = 0)
  }
  
  return undefined; // Daily doesn't need a billing day
}

/**
 * Calculate confidence level based on transaction pattern
 */
function calculateConfidence(
  transactionCount: number,
  amountVariance: number,
  dateRegularity: number,
  isKnownService: boolean
): "high" | "medium" | "low" {
  let score = 0;
  
  // More transactions = higher confidence
  if (transactionCount >= 6) score += 3;
  else if (transactionCount >= 4) score += 2;
  else if (transactionCount >= 2) score += 1;
  
  // Lower variance = higher confidence
  if (amountVariance < 0.05) score += 3; // Less than 5% variance
  else if (amountVariance < 0.10) score += 2; // Less than 10% variance
  else if (amountVariance < 0.20) score += 1; // Less than 20% variance
  
  // More regular dates = higher confidence
  if (dateRegularity > 0.8) score += 2;
  else if (dateRegularity > 0.6) score += 1;
  
  // Known service = higher confidence
  if (isKnownService) score += 2;
  
  if (score >= 7) return "high";
  if (score >= 4) return "medium";
  return "low";
}

/**
 * Calculate amount variance (coefficient of variation)
 */
function calculateAmountVariance(amounts: number[]): number {
  if (amounts.length < 2) return 0;
  
  const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const variance = amounts.reduce((sum, amount) => sum + Math.pow(amount - mean, 2), 0) / amounts.length;
  const stdDev = Math.sqrt(variance);
  
  return mean > 0 ? stdDev / mean : 0; // Coefficient of variation
}

/**
 * Calculate date regularity (how consistent the intervals are)
 */
function calculateDateRegularity(dates: Date[]): number {
  if (dates.length < 2) return 1;
  
  const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const intervals: number[] = [];
  
  for (let i = 1; i < sortedDates.length; i++) {
    const diff = sortedDates[i].getTime() - sortedDates[i - 1].getTime();
    intervals.push(diff / (1000 * 60 * 60 * 24)); // Convert to days
  }
  
  if (intervals.length === 0) return 1;
  
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - mean, 2), 0) / intervals.length;
  const stdDev = Math.sqrt(variance);
  
  // Regularity is inverse of coefficient of variation
  // Lower stdDev relative to mean = higher regularity
  return mean > 0 ? Math.max(0, 1 - (stdDev / mean)) : 0;
}

/**
 * Detect subscriptions from user transactions
 */
export async function detectSubscriptionsFromTransactions(): Promise<DetectedSubscription[]> {
  const supabase = await createServerClient();
  
  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    logger.warn("[detectSubscriptions] User not authenticated:", authError?.message);
    return [];
  }
  
  logger.info(`[detectSubscriptions] Detecting subscriptions for user: ${user.id}`);
  
  // Get transactions from last 6 months
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 6);
  
  // Get all expense transactions (excluding transfers)
  const { data: transactions, error } = await supabase
    .from("Transaction")
    .select(`
      id,
      date,
      amount,
      description,
      accountId,
      plaidMetadata,
      account:Account(id, name)
    `)
    .eq("type", "expense")
    .gte("date", startDate.toISOString().split("T")[0])
    .lte("date", endDate.toISOString().split("T")[0])
    .order("date", { ascending: true });
  
  if (error) {
    logger.error("[detectSubscriptions] Error fetching transactions:", error);
    return [];
  }
  
  if (!transactions || transactions.length === 0) {
    logger.debug("[detectSubscriptions] No transactions found");
    return [];
  }
  
  // Group transactions by merchant
  const merchantGroups = new Map<string, {
    transactions: typeof transactions;
    merchantName: string;
    merchantEntityId?: string | null;
    logoUrl?: string | null;
    accountId: string;
    accountName: string;
  }>();
  
  for (const tx of transactions) {
    const plaidMetadata = tx.plaidMetadata as PlaidTransactionMetadata | null;
    const merchantName = getPlaidMetadataField(plaidMetadata, "merchantName", "merchant_name") || 
                        decryptDescription(tx.description) || 
                        "";
    
    if (!merchantName || merchantName.trim().length === 0) {
      continue; // Skip transactions without merchant name
    }
    
    const normalizedMerchant = normalizeMerchantName(merchantName);
    const merchantEntityId = getPlaidMetadataField(plaidMetadata, "merchantEntityId", "merchant_entity_id");
    const logoUrl = getPlaidMetadataField(plaidMetadata, "logoUrl", "logo_url");
    
    const account = Array.isArray(tx.account) ? tx.account[0] : tx.account;
    const accountId = tx.accountId;
    const accountName = account?.name || "Unknown Account";
    
    // Use normalized merchant name as key, but store original
    const key = `${normalizedMerchant}_${accountId}`;
    
    if (!merchantGroups.has(key)) {
      merchantGroups.set(key, {
        transactions: [],
        merchantName: merchantName.trim(),
        merchantEntityId: merchantEntityId || null,
        logoUrl: logoUrl || null,
        accountId,
        accountName,
      });
    }
    
    merchantGroups.get(key)!.transactions.push(tx);
  }
  
  // Analyze each merchant group for subscription patterns
  const detectedSubscriptions: DetectedSubscription[] = [];
  
  for (const [key, group] of merchantGroups.entries()) {
    const transactions = group.transactions;
    
    // Need at least 2 transactions to detect a pattern
    if (transactions.length < 2) {
      continue;
    }
    
    // Get amounts and dates
    const amounts = transactions.map(tx => {
      const amount = getTransactionAmount(tx.amount);
      return amount ?? 0;
    }).filter(amount => amount > 0);
    
    const dates = transactions.map(tx => new Date(tx.date));
    
    if (amounts.length < 2) {
      continue;
    }
    
    // Calculate statistics
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const amountVariance = calculateAmountVariance(amounts);
    const dateRegularity = calculateDateRegularity(dates);
    
    // Check if this looks like a subscription
    // Criteria:
    // 1. At least 2 transactions
    // 2. Amount variance < 30% (subscriptions are usually fixed price)
    // 3. Date regularity > 0.4 (somewhat regular intervals)
    // 4. Or known subscription service
    const knownService = findKnownSubscriptionService(group.merchantName);
    const isKnownService = !!knownService;
    
    const looksLikeSubscription = 
      amountVariance < 0.30 && // Less than 30% variance in amount
      dateRegularity > 0.4; // At least 40% date regularity
    
    if (!looksLikeSubscription && !isKnownService) {
      continue; // Doesn't look like a subscription
    }
    
    // Calculate frequency
    const frequency = knownService?.typicalFrequency || calculateFrequency(dates);
    const billingDay = calculateBillingDay(frequency, dates);
    
    // Calculate confidence
    const confidence = calculateConfidence(
      transactions.length,
      amountVariance,
      dateRegularity,
      isKnownService
    );
    
    // Get first and last transaction dates
    const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());
    const firstBillingDate = sortedDates[0];
    const lastTransactionDate = sortedDates[sortedDates.length - 1];
    
    // Use known service name if available
    const serviceName = knownService?.name || group.merchantName;
    const serviceLogo = knownService?.logoUrl || group.logoUrl;
    
    detectedSubscriptions.push({
      merchantName: serviceName,
      merchantEntityId: group.merchantEntityId,
      logoUrl: serviceLogo,
      amount: Math.round(avgAmount * 100) / 100, // Round to 2 decimals
      frequency,
      billingDay,
      firstBillingDate: firstBillingDate.toISOString().split("T")[0],
      accountId: group.accountId,
      accountName: group.accountName,
      transactionCount: transactions.length,
      lastTransactionDate: lastTransactionDate.toISOString().split("T")[0],
      confidence,
      description: `Detected from ${transactions.length} transaction(s)`,
      transactionIds: transactions.map(tx => tx.id),
    });
  }
  
  // Sort by confidence (high first) and then by transaction count
  detectedSubscriptions.sort((a, b) => {
    const confidenceOrder = { high: 3, medium: 2, low: 1 };
    const confidenceDiff = confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
    if (confidenceDiff !== 0) return confidenceDiff;
    return b.transactionCount - a.transactionCount;
  });
  
  logger.info(`[detectSubscriptions] Detected ${detectedSubscriptions.length} potential subscriptions`);
  
  return detectedSubscriptions;
}

