import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceRoleClient } from "@/src/infrastructure/database/supabase-server";
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
  typescript: true,
});

async function isSuperAdmin(): Promise<boolean> {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return false;
    }

    const { data: userData } = await supabase
      .from("User")
      .select("role")
      .eq("id", user.id)
      .single();

    return userData?.role === "super_admin";
  } catch (error) {
    console.error("Error checking super_admin status:", error);
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json(
        { error: "Unauthorized: Only super_admin can access this endpoint" },
        { status: 403 }
      );
    }

    // Use service role client to bypass RLS and get all data
    const supabase = createServiceRoleClient();

    // Get all users count
    const { count: totalUsers, error: usersError } = await supabase
      .from("User")
      .select("*", { count: "exact", head: true });

    if (usersError) {
      console.error("Error fetching users count:", usersError);
    }

    // Get all subscriptions with their plans
    const { data: subscriptions, error: subsError } = await supabase
      .from("Subscription")
      .select(`
        id,
        userId,
        planId,
        status,
        trialStartDate,
        trialEndDate,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd,
        stripeSubscriptionId,
        plan:Plan(
          id,
          name,
          priceMonthly,
          priceYearly,
          stripePriceIdMonthly,
          stripePriceIdYearly
        )
      `)
      .order("createdAt", { ascending: false });

    if (subsError) {
      console.error("Error fetching subscriptions:", subsError);
    } else {
      console.log(`[dashboard] Found ${subscriptions?.length || 0} subscriptions`);
    }

    // Get all plans
    const { data: plans, error: plansError } = await supabase
      .from("Plan")
      .select("id, name, priceMonthly, priceYearly")
      .order("priceMonthly", { ascending: true });

    if (plansError) {
      console.error("Error fetching plans:", plansError);
    }

    const now = new Date();
    const subscriptionsList = subscriptions || [];

    console.log(`[dashboard] Processing ${subscriptionsList.length} subscriptions`);

    // Calculate metrics
    const activeSubscriptions = subscriptionsList.filter(
      (sub) => sub.status === "active"
    );
    const trialingSubscriptions = subscriptionsList.filter(
      (sub) => sub.status === "trialing"
    );
    const cancelledSubscriptions = subscriptionsList.filter(
      (sub) => sub.status === "cancelled"
    );
    const pastDueSubscriptions = subscriptionsList.filter(
      (sub) => sub.status === "past_due"
    );

    console.log(`[dashboard] Metrics:`, {
      total: subscriptionsList.length,
      active: activeSubscriptions.length,
      trialing: trialingSubscriptions.length,
      cancelled: cancelledSubscriptions.length,
      pastDue: pastDueSubscriptions.length,
    });

    // Calculate MRR (Monthly Recurring Revenue)
    // For active subscriptions, we need to determine if they're monthly or yearly
    let mrr = 0;
    const subscriptionDetails: Array<{
      subscriptionId: string;
      userId: string;
      planId: string;
      planName: string;
      status: string;
      monthlyRevenue: number;
      interval: "month" | "year" | "unknown";
      trialEndDate: string | null;
    }> = [];

    // Fetch Stripe subscription data in parallel (with error handling)
    const stripeSubscriptions = await Promise.allSettled(
      activeSubscriptions
        .filter((sub) => sub.stripeSubscriptionId)
        .map((sub) =>
          stripe.subscriptions.retrieve(sub.stripeSubscriptionId!).then(
            (stripeSub) => ({ dbSubscriptionId: sub.id, stripeSub }),
            (error) => ({ dbSubscriptionId: sub.id, error })
          )
        )
    );

    // Create a map of database subscription ID to Stripe data
    const stripeSubMap = new Map<string, Stripe.Subscription>();
    stripeSubscriptions.forEach((result) => {
      if (result.status === "fulfilled") {
        const value = result.value as { dbSubscriptionId: string; stripeSub: Stripe.Subscription } | { dbSubscriptionId: string; error: any };
        if (!("error" in value)) {
          stripeSubMap.set(value.dbSubscriptionId, value.stripeSub);
        }
      }
    });

    for (const sub of activeSubscriptions) {
      // Handle plan as array (from Supabase join) or single object
      const plan = Array.isArray(sub.plan) ? sub.plan[0] : sub.plan;
      if (!plan) continue;

      let monthlyRevenue = 0;
      let interval: "month" | "year" | "unknown" = "unknown";

      // Try to determine interval from Stripe if available
      const stripeSub = sub.stripeSubscriptionId
        ? stripeSubMap.get(sub.id)
        : null;

      if (stripeSub) {
        const priceId = stripeSub.items.data[0]?.price.id;

        if (priceId === plan.stripePriceIdMonthly) {
          interval = "month";
          monthlyRevenue = Number(plan.priceMonthly) || 0;
        } else if (priceId === plan.stripePriceIdYearly) {
          interval = "year";
          // Convert yearly to monthly for MRR
          monthlyRevenue = (Number(plan.priceYearly) || 0) / 12;
        } else {
          // Fallback: assume monthly if we can't determine
          interval = "month";
          monthlyRevenue = Number(plan.priceMonthly) || 0;
        }
      } else {
        // No Stripe subscription ID or failed to fetch, assume monthly
        interval = "month";
        monthlyRevenue = Number(plan.priceMonthly) || 0;
      }

      mrr += monthlyRevenue;

      subscriptionDetails.push({
        subscriptionId: sub.id,
        userId: sub.userId,
        planId: sub.planId,
        planName: plan.name,
        status: sub.status,
        monthlyRevenue,
        interval,
        trialEndDate: sub.trialEndDate,
      });
    }

    // Calculate future revenue from trials
    // This estimates revenue if all trialing users convert to paid
    let estimatedFutureMRR = 0;
    const upcomingTrials: Array<{
      subscriptionId: string;
      userId: string;
      planId: string;
      planName: string;
      trialEndDate: string;
      daysUntilEnd: number;
      estimatedMonthlyRevenue: number;
    }> = [];

    for (const sub of trialingSubscriptions) {
      // Handle plan as array (from Supabase join) or single object
      const plan = Array.isArray(sub.plan) ? sub.plan[0] : sub.plan;
      if (!plan || !sub.trialEndDate) continue;

      const trialEnd = new Date(sub.trialEndDate);
      const daysUntilEnd = Math.ceil(
        (trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Only count trials that haven't ended
      if (daysUntilEnd > 0) {
        // Assume they'll convert to monthly plan
        const estimatedMonthlyRevenue = Number(plan.priceMonthly) || 0;
        estimatedFutureMRR += estimatedMonthlyRevenue;

        upcomingTrials.push({
          subscriptionId: sub.id,
          userId: sub.userId,
          planId: sub.planId,
          planName: plan.name,
          trialEndDate: sub.trialEndDate,
          daysUntilEnd,
          estimatedMonthlyRevenue,
        });
      }
    }

    // Sort upcoming trials by days until end
    upcomingTrials.sort((a, b) => a.daysUntilEnd - b.daysUntilEnd);

    // Calculate distribution by plan
    const planDistribution: Record<
      string,
      {
        planId: string;
        planName: string;
        activeCount: number;
        trialingCount: number;
        totalCount: number;
      }
    > = {};

    plans?.forEach((plan) => {
      planDistribution[plan.id] = {
        planId: plan.id,
        planName: plan.name,
        activeCount: 0,
        trialingCount: 0,
        totalCount: 0,
      };
    });

    subscriptionsList.forEach((sub) => {
      // Handle plan as array (from Supabase join) or single object
      const plan = Array.isArray(sub.plan) ? sub.plan[0] : sub.plan;
      if (plan && planDistribution[sub.planId]) {
        planDistribution[sub.planId].totalCount++;
        if (sub.status === "active") {
          planDistribution[sub.planId].activeCount++;
        } else if (sub.status === "trialing") {
          planDistribution[sub.planId].trialingCount++;
        }
      }
    });

    // Calculate users without subscription
    const usersWithSubscription = new Set(
      subscriptionsList.map((sub) => sub.userId)
    );
    const usersWithoutSubscription =
      (totalUsers || 0) - usersWithSubscription.size;

    // Calculate churn risk (subscriptions that will cancel at period end)
    const churnRisk = activeSubscriptions.filter(
      (sub) => sub.cancelAtPeriodEnd === true
    ).length;

    return NextResponse.json({
      overview: {
        totalUsers: totalUsers || 0,
        usersWithoutSubscription,
        totalSubscriptions: subscriptionsList.length,
        activeSubscriptions: activeSubscriptions.length,
        trialingSubscriptions: trialingSubscriptions.length,
        cancelledSubscriptions: cancelledSubscriptions.length,
        pastDueSubscriptions: pastDueSubscriptions.length,
        churnRisk,
      },
      financial: {
        mrr: Math.round(mrr * 100) / 100, // Round to 2 decimals
        estimatedFutureMRR: Math.round(estimatedFutureMRR * 100) / 100,
        totalEstimatedMRR: Math.round((mrr + estimatedFutureMRR) * 100) / 100,
        subscriptionDetails,
        upcomingTrials: upcomingTrials.slice(0, 10), // Top 10 upcoming trials
      },
      planDistribution: Object.values(planDistribution),
    });
  } catch (error: any) {
    console.error("Error fetching dashboard data:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}

