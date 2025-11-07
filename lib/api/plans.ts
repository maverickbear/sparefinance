"use server";

import { createServerClient } from "@/lib/supabase-server";
import { Plan, PlanFeatures, Subscription } from "@/lib/validations/plan";
import { getOwnerIdForMember, isHouseholdMember } from "./members";

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
    
    // Check if user is an active household member
    const isMember = await isHouseholdMember(userId);
    console.log("[PLANS] getUserSubscription - userId:", userId, "isMember:", isMember);
    
    if (isMember) {
      // User is a household member, inherit plan from owner
      const ownerId = await getOwnerIdForMember(userId);
      console.log("[PLANS] getUserSubscription - ownerId:", ownerId);
      
      if (ownerId) {
        // Get owner's subscription
        const { data: ownerSubscription, error: ownerError } = await supabase
          .from("Subscription")
          .select("*")
          .eq("userId", ownerId)
          .eq("status", "active")
          .order("createdAt", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (ownerError && ownerError.code !== "PGRST116") {
          console.error("[PLANS] Error fetching owner subscription:", ownerError);
        }

        console.log("[PLANS] getUserSubscription - ownerSubscription:", ownerSubscription ? { planId: ownerSubscription.planId, status: ownerSubscription.status } : null);

        if (ownerSubscription) {
          // Owner has a subscription, return it as shadow subscription for the member
          // Only inherit if owner has Basic or Premium plan
          const ownerPlanId = ownerSubscription.planId;
          console.log("[PLANS] getUserSubscription - ownerPlanId:", ownerPlanId);
          
          if (ownerPlanId === "basic" || ownerPlanId === "premium") {
            console.log("[PLANS] getUserSubscription - Returning shadow subscription for member:", userId, "with plan:", ownerPlanId);
            return {
              id: ownerSubscription.id,
              userId, // Use member's userId, but owner's subscription data
              planId: ownerPlanId,
              status: ownerSubscription.status,
              stripeSubscriptionId: ownerSubscription.stripeSubscriptionId,
              stripeCustomerId: ownerSubscription.stripeCustomerId,
              currentPeriodStart: ownerSubscription.currentPeriodStart ? new Date(ownerSubscription.currentPeriodStart) : null,
              currentPeriodEnd: ownerSubscription.currentPeriodEnd ? new Date(ownerSubscription.currentPeriodEnd) : null,
              cancelAtPeriodEnd: ownerSubscription.cancelAtPeriodEnd || false,
              createdAt: ownerSubscription.createdAt ? new Date(ownerSubscription.createdAt) : new Date(),
              updatedAt: ownerSubscription.updatedAt ? new Date(ownerSubscription.updatedAt) : new Date(),
            };
          } else {
            console.log("[PLANS] getUserSubscription - Owner has Free plan, member will get Free");
          }
          // If owner has Free plan, fall through to return Free for member
        } else {
          console.log("[PLANS] getUserSubscription - Owner has no active subscription");
        }
        // If owner has no subscription or has Free, return Free for member
      } else {
        console.log("[PLANS] getUserSubscription - Could not find ownerId for member");
      }
    } else {
      console.log("[PLANS] getUserSubscription - User is not a household member");
    }
    
    // User is not a member, or owner has Free/no subscription - check user's own subscription
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

export interface UserPlanInfo {
  name: "free" | "basic" | "premium";
  isShadow: boolean; // true se herdado do owner
  ownerId?: string; // se for shadow subscription
  ownerName?: string; // nome do owner (se for shadow)
}

export async function getUserPlanInfo(userId: string): Promise<UserPlanInfo | null> {
  try {
    const supabase = await createServerClient();
    
    // Optimize: Check household membership and get ownerId in a single query
    const { data: member, error: memberError } = await supabase
      .from("HouseholdMember")
      .select("ownerId, status")
      .eq("memberId", userId)
      .eq("status", "active")
      .maybeSingle();

    if (memberError && memberError.code !== "PGRST116") {
      console.error("[PLANS] Error checking household membership:", memberError);
    }

    const isMember = member !== null;
    const ownerId = member?.ownerId || null;
    
    if (isMember && ownerId) {
      // User is a household member, inherit plan from owner
      // Fetch owner's subscription and name in parallel
      const [ownerSubscriptionResult, ownerResult] = await Promise.all([
        supabase
          .from("Subscription")
          .select("*")
          .eq("userId", ownerId)
          .eq("status", "active")
          .order("createdAt", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("User")
          .select("name, email")
          .eq("id", ownerId)
          .maybeSingle(),
      ]);

      const { data: ownerSubscription, error: ownerError } = ownerSubscriptionResult;
      const { data: owner } = ownerResult;

      if (ownerError && ownerError.code !== "PGRST116") {
        console.error("[PLANS] Error fetching owner subscription:", ownerError);
      }

      if (ownerSubscription) {
        // Owner has a subscription, check if it's Basic or Premium
        const ownerPlanId = ownerSubscription.planId;
        
        if (ownerPlanId === "basic" || ownerPlanId === "premium") {
          return {
            name: ownerPlanId as "basic" | "premium",
            isShadow: true,
            ownerId,
            ownerName: owner?.name || owner?.email || undefined,
          };
        }
        // If owner has Free plan, fall through to return Free
      }
      // If owner has no subscription or has Free, return Free for member
    }
    
    // User is not a member, or owner has Free/no subscription - check user's own subscription
    const subscription = await getUserSubscription(userId);
    
    if (subscription) {
      return {
        name: subscription.planId as "free" | "basic" | "premium",
        isShadow: false,
      };
    }

    // Default to free
    return {
      name: "free",
      isShadow: false,
    };
  } catch (error) {
    console.error("[PLANS] Error in getUserPlanInfo:", error);
    return {
      name: "free",
      isShadow: false,
    };
  }
}

