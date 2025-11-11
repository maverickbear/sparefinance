"use client";

import { supabase } from "@/lib/supabase";
import { getCurrentUserClient, User } from "./auth-client";

/**
 * Get current user with plan info and trial information
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
  const user = await getCurrentUserClient();
  
  if (!user) {
    return { user: null, plan: null, subscription: null };
  }

  // Get user's subscription (active or trialing)
  const { data: subscription } = await supabase
    .from("Subscription")
    .select("planId, status, trialEndDate, trialStartDate")
    .eq("userId", user.id)
    .in("status", ["active", "trialing"])
    .order("createdAt", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!subscription) {
    return { user, plan: null, subscription: null };
  }

  // Get plan info
  const { data: plan } = await supabase
    .from("Plan")
    .select("name")
    .eq("id", subscription.planId)
    .single();

  return {
    user,
    plan: plan ? { name: plan.name } : null,
    subscription: {
      status: subscription.status as "active" | "trialing" | "cancelled" | "past_due",
      trialEndDate: subscription.trialEndDate,
      trialStartDate: subscription.trialStartDate,
    },
  };
}

