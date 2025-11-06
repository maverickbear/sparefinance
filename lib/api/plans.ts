"use server";

import { createServerClient } from "@/lib/supabase-server";
import { Plan, PlanFeatures, Subscription } from "@/lib/validations/plan";

export interface PlanWithSubscription extends Plan {
  subscription?: Subscription;
}

export async function getPlans(): Promise<Plan[]> {
  try {
    const supabase = await createServerClient();
    
    const { data: plans, error } = await supabase
      .from("Plan")
      .select("*")
      .order("priceMonthly", { ascending: true });

    if (error || !plans) {
      console.error("Error fetching plans:", error);
      return [];
    }

    return plans.map(mapPlan);
  } catch (error) {
    console.error("Error in getPlans:", error);
    return [];
  }
}

export async function getPlanById(planId: string): Promise<Plan | null> {
  try {
    const supabase = await createServerClient();
    
    const { data: plan, error } = await supabase
      .from("Plan")
      .select("*")
      .eq("id", planId)
      .single();

    if (error || !plan) {
      console.error("Error fetching plan:", error);
      return null;
    }

    return mapPlan(plan);
  } catch (error) {
    console.error("Error in getPlanById:", error);
    return null;
  }
}

export async function getUserSubscription(userId: string): Promise<Subscription | null> {
  try {
    const supabase = await createServerClient();
    
    // Use maybeSingle() instead of single() to handle case when no subscription exists
    // This prevents 406 errors when there are 0 results
    const { data: subscription, error } = await supabase
      .from("Subscription")
      .select("*")
      .eq("userId", userId)
      .eq("status", "active")
      .order("createdAt", { ascending: false })
      .limit(1)
      .maybeSingle();

    // If error is PGRST116 (no rows returned), it's expected when no subscription exists
    // Other errors should be logged
    if (error && error.code !== "PGRST116") {
      console.error("[PLANS] Error fetching subscription:", error);
    }

    if (!subscription) {
      // Return free subscription as default
      return {
        id: "free-default",
        userId,
        planId: "free",
        status: "active",
        stripeSubscriptionId: null,
        stripeCustomerId: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return mapSubscription(subscription);
  } catch (error) {
    console.error("[PLANS] Error in getUserSubscription:", error);
    // Return free subscription as default
    return {
      id: "free-default",
      userId,
      planId: "free",
      status: "active",
      stripeSubscriptionId: null,
      stripeCustomerId: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

export async function getCurrentUserSubscription(): Promise<Subscription | null> {
  try {
    const supabase = await createServerClient();
    
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return null;
    }

    // getUserSubscription always returns a subscription (at least "free" as default)
    // So this should never be null if user is authenticated
    const subscription = await getUserSubscription(authUser.id);
    return subscription;
  } catch (error) {
    console.error("Error in getCurrentUserSubscription:", error);
    // Even on error, if we have a user, we should return a free subscription
    // But we can't access the user here, so return null
    return null;
  }
}

export async function checkPlanLimits(userId: string): Promise<{
  plan: Plan | null;
  subscription: Subscription | null;
  limits: PlanFeatures;
}> {
  try {
    const subscription = await getUserSubscription(userId);
    if (!subscription) {
      // Default to free plan
      const freePlan = await getPlanById("free");
      return {
        plan: freePlan,
        subscription: null,
        limits: freePlan?.features || getDefaultFeatures(),
      };
    }

    const plan = await getPlanById(subscription.planId);
    if (!plan) {
      return {
        plan: null,
        subscription,
        limits: getDefaultFeatures(),
      };
    }

    return {
      plan,
      subscription,
      limits: plan.features,
    };
  } catch (error) {
    console.error("Error in checkPlanLimits:", error);
    return {
      plan: null,
      subscription: null,
      limits: getDefaultFeatures(),
    };
  }
}

function mapPlan(data: any): Plan {
  let features: PlanFeatures;
  try {
    features = typeof data.features === "string" 
      ? JSON.parse(data.features) 
      : data.features;
  } catch {
    features = getDefaultFeatures();
  }

  return {
    id: data.id,
    name: data.name,
    priceMonthly: parseFloat(data.priceMonthly) || 0,
    priceYearly: parseFloat(data.priceYearly) || 0,
    features,
    stripePriceIdMonthly: data.stripePriceIdMonthly,
    stripePriceIdYearly: data.stripePriceIdYearly,
    stripeProductId: data.stripeProductId,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
  };
}

function mapSubscription(data: any): Subscription {
  return {
    id: data.id,
    userId: data.userId,
    planId: data.planId,
    status: data.status,
    stripeSubscriptionId: data.stripeSubscriptionId,
    stripeCustomerId: data.stripeCustomerId,
    currentPeriodStart: data.currentPeriodStart ? new Date(data.currentPeriodStart) : null,
    currentPeriodEnd: data.currentPeriodEnd ? new Date(data.currentPeriodEnd) : null,
    cancelAtPeriodEnd: data.cancelAtPeriodEnd || false,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
  };
}

function getDefaultFeatures(): PlanFeatures {
  return {
    maxTransactions: 50,
    maxAccounts: 2,
    hasInvestments: false,
    hasAdvancedReports: false,
    hasCsvExport: false,
    hasDebts: true,
    hasGoals: true,
  };
}

