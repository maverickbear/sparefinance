"use server";

import { getAccounts } from "./accounts";
import { getProfile } from "./profile";

export interface OnboardingStatus {
  hasAccount: boolean;
  hasCompleteProfile: boolean;
  completedCount: number;
  totalCount: number;
  totalBalance?: number;
}

/**
 * Check onboarding status for the current user
 * Returns status of 2 essential actions:
 * 1. Create Account (hasAccount)
 * 2. Complete Profile (hasCompleteProfile)
 */
export async function checkOnboardingStatus(): Promise<OnboardingStatus> {
  try {
    // Check if user has at least 1 account
    const accounts = await getAccounts();
    const hasAccount = accounts.length > 0;

    // Calculate total balance if accounts exist
    const totalBalance = accounts.reduce(
      (sum: number, acc: any) => sum + (acc.balance || 0),
      0
    );

    // Check if profile is complete (has name)
    const profile = await getProfile();
    const hasCompleteProfile = profile !== null && profile.name !== null && profile.name.trim() !== "";

    const completedCount = [hasAccount, hasCompleteProfile].filter(Boolean).length;
    const totalCount = 2;

    return {
      hasAccount,
      hasCompleteProfile,
      completedCount,
      totalCount,
      totalBalance: hasAccount ? totalBalance : undefined,
    };
  } catch (error) {
    console.error("Error checking onboarding status:", error);
    // Return default status on error
    return {
      hasAccount: false,
      hasCompleteProfile: false,
      completedCount: 0,
      totalCount: 2,
    };
  }
}

