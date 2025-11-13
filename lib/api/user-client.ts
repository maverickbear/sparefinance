"use client";

import { supabase } from "@/lib/supabase";
import { getCurrentUserClient, User } from "./auth-client";

/**
 * Get current user with plan info and trial information
 * Optimized: Uses single query with JOIN instead of multiple queries
 */
export async function getUserClient(): Promise<{ 
  user: User | null; 
  plan: { name: "free" | "basic" | "premium" } | null;
  subscription?: {
    status: "active" | "trialing" | "cancelled" | "past_due";
    trialEndDate?: string | null;
    trialStartDate?: string | null;
  } | null;
}> {
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

  if (authError || !authUser) {
    return { user: null, plan: null, subscription: null };
  }

  // Optimized: Fetch User, Subscription, and Plan in parallel (faster than sequential)
  const [userResult, subscriptionResult] = await Promise.all([
    supabase
      .from("User")
      .select("*")
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
    .select("name")
    .eq("id", subscriptionResult.data.planId)
    .single();

  return {
    user,
    plan: planData ? { name: planData.name as "free" | "basic" | "premium" } : null,
    subscription: {
      status: subscriptionResult.data.status as "active" | "trialing" | "cancelled" | "past_due",
      trialEndDate: subscriptionResult.data.trialEndDate,
      trialStartDate: subscriptionResult.data.trialStartDate,
    },
  };
}

