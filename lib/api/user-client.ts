"use client";

import { supabase } from "@/lib/supabase";
import { getCurrentUserClient, User } from "./auth-client";

/**
 * Get current user with plan info
 */
export async function getUserClient(): Promise<{ user: User | null; plan: { name: "free" | "basic" | "premium" } | null }> {
  const user = await getCurrentUserClient();
  
  if (!user) {
    return { user: null, plan: null };
  }

  // Get user's subscription
  const { data: subscription } = await supabase
    .from("Subscription")
    .select("planId, status")
    .eq("userId", user.id)
    .eq("status", "active")
    .single();

  if (!subscription) {
    return { user, plan: null };
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
  };
}

