"use client";

import { supabase } from "@/lib/supabase";
import { getCurrentUserClient, User } from "./auth-client";

/**
 * Get current user with plan info and trial information
 * Optimized: Uses single query with JOIN instead of multiple queries
 */
export async function getUserClient(): Promise<{ 
  user: User | null; 
  plan: { id: string; name: string } | null;
  subscription?: {
    status: "active" | "trialing" | "cancelled" | "past_due";
    trialEndDate?: string | null;
    trialStartDate?: string | null;
  } | null;
}> {
  // Retry logic for session establishment (handles "Session not found" errors)
  let authUser = null;
  let authError = null;
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts && (!authUser || authError)) {
    const result = await supabase.auth.getUser();
    authUser = result.data.user;
    authError = result.error;

    // If it's a session error, retry after a delay
    if (authError && (
      authError.message?.includes("Session not found") ||
      authError.message?.includes("session") ||
      authError.status === 401
    )) {
      attempts++;
      if (attempts < maxAttempts) {
        console.warn(`[getUserClient] Session not ready (attempt ${attempts}/${maxAttempts}), retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
    } else if (authError || !authUser) {
      // Non-session error or no user, don't retry
      break;
    } else {
      // Success, break out of loop
      break;
    }
  }

  if (authError || !authUser) {
    return { user: null, plan: null, subscription: null };
  }

  // Optimized: Fetch User, Subscription, and Plan in parallel (faster than sequential)
  // PERFORMANCE: Select only necessary fields instead of * to reduce payload size
  const [userResult, subscriptionResult] = await Promise.all([
    supabase
      .from("User")
      .select("id, email, name, avatarUrl, phoneNumber, dateOfBirth, role, createdAt, updatedAt")
      .eq("id", authUser.id)
      .single(),
    supabase
      .from("Subscription")
      .select("planId, status, trialEndDate, trialStartDate")
      .eq("userId", authUser.id)
      .in("status", ["active", "trialing", "cancelled", "past_due"])
      .order("createdAt", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (userResult.error || !userResult.data) {
    console.warn(`[getUserClient] User ${authUser.id} not found. Logging out.`);
    try {
      await supabase.auth.signOut();
    } catch (signOutError) {
      console.error("[getUserClient] Error signing out:", signOutError);
    }
    return { user: null, plan: null, subscription: null };
  }

  const userData = userResult.data;
  const user: User = {
    id: userData.id,
    email: userData.email,
    name: userData.name || undefined,
    avatarUrl: userData.avatarUrl || undefined,
    phoneNumber: userData.phoneNumber || undefined,
    dateOfBirth: userData.dateOfBirth || undefined,
    role: userData.role || "admin",
    createdAt: new Date(userData.createdAt),
    updatedAt: new Date(userData.updatedAt),
  };

  if (!subscriptionResult.data) {
    return { user, plan: null, subscription: null };
  }

  // Fetch plan in parallel if we have subscription
  const { data: planData } = await supabase
    .from("Plan")
    .select("id, name")
    .eq("id", subscriptionResult.data.planId)
    .single();

  return {
    user,
    plan: planData ? { id: planData.id, name: planData.name } : null,
    subscription: {
      status: subscriptionResult.data.status as "active" | "trialing" | "cancelled" | "past_due",
      trialEndDate: subscriptionResult.data.trialEndDate,
      trialStartDate: subscriptionResult.data.trialStartDate,
    },
  };
}

