/**
 * Format Expected Income Range for Display
 * Utility functions for formatting expected income ranges
 */

import { ExpectedIncomeRange } from "@/src/domain/onboarding/onboarding.types";

/**
 * Format expected income range to display string
 */
export function formatExpectedIncomeRange(incomeRange: ExpectedIncomeRange | string | null): string {
  if (!incomeRange) {
    return "";
  }

  const range = incomeRange as string;
  
  if (range === "0-50k") {
    return "$0 - $50,000";
  }
  if (range === "50k-100k") {
    return "$50,000 - $100,000";
  }
  if (range === "100k-150k") {
    return "$100,000 - $150,000";
  }
  if (range === "150k-250k") {
    return "$150,000 - $250,000";
  }
  if (range === "250k+") {
    return "$250,000+";
  }

  return range;
}

/**
 * Get short format for expected income range
 */
export function formatExpectedIncomeRangeShort(incomeRange: ExpectedIncomeRange | string | null): string {
  if (!incomeRange) {
    return "";
  }

  const range = incomeRange as string;
  
  if (range === "0-50k") {
    return "$0-50k";
  }
  if (range === "50k-100k") {
    return "$50k-100k";
  }
  if (range === "100k-150k") {
    return "$100k-150k";
  }
  if (range === "150k-250k") {
    return "$150k-250k";
  }
  if (range === "250k+") {
    return "$250k+";
  }

  return range;
}

