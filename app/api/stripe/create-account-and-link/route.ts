import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { validatePasswordAgainstHIBP } from "@/lib/utils/hibp";
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
  typescript: true,
});

/**
 * POST /api/stripe/create-account-and-link
 * Creates a user account and links their Stripe subscription
 * Used when a user completes checkout before signing up
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name, customerId } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "email and password are required" },
        { status: 400 }
      );
    }

    if (!customerId) {
      return NextResponse.json(
        { error: "customerId is required" },
        { status: 400 }
      );
    }

    // Validate password against HIBP
    const passwordValidation = await validatePasswordAgainstHIBP(password);
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        { error: passwordValidation.error || "Invalid password" },
        { status: 400 }
      );
    }

    // Create user account
    const supabase = await createServerClient();
    
    // Sign up the user
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name || "",
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "https://sparefinance.com"}/dashboard`,
      },
    });

    if (signUpError || !authData.user) {
      console.error("[CREATE-ACCOUNT] Error signing up:", signUpError);
      return NextResponse.json(
        { error: signUpError?.message || "Failed to create account" },
        { status: 400 }
      );
    }

    // Create user profile in User table
    const { data: userData, error: userError } = await supabase
      .from("User")
      .insert({
        id: authData.user.id,
        email: authData.user.email!,
        name: name || null,
        role: "admin", // Owners who sign up directly are admins
      })
      .select()
      .single();

    if (userError) {
      console.error("[CREATE-ACCOUNT] Error creating user profile:", userError);
      // User is created in auth but not in User table - this is OK, will be created on first login
    }

    // Create household member record for the owner
    if (userData) {
      const invitationToken = crypto.randomUUID();
      const now = new Date().toISOString();
      
      const { error: householdMemberError } = await supabase
        .from("HouseholdMember")
        .insert({
          ownerId: userData.id,
          memberId: userData.id,
          email: authData.user.email!,
          name: name || null,
          role: "admin",
          status: "active",
          invitationToken: invitationToken,
          invitedAt: now,
          acceptedAt: now,
          createdAt: now,
          updatedAt: now,
        });

      if (householdMemberError) {
        console.error("[CREATE-ACCOUNT] Error creating household member:", householdMemberError);
        // Don't fail - this is not critical
      }
    }

    // Wait a bit for the user record to be fully created
    await new Promise(resolve => setTimeout(resolve, 500));

    // Find active subscription for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      // User created but no subscription found - this is OK, they can link later
      console.log("[CREATE-ACCOUNT] User created but no subscription found yet");
      return NextResponse.json({
        success: true,
        message: "Account created successfully. Subscription will be linked automatically.",
        userId: authData.user.id,
      });
    }

    const stripeSubscription = subscriptions.data[0] as Stripe.Subscription;

    // Get price ID to find plan
    const priceId = stripeSubscription.items.data[0]?.price.id;
    if (!priceId) {
      return NextResponse.json(
        { error: "No price ID found in subscription" },
        { status: 400 }
      );
    }

    // Find plan by price ID
    const { data: plan, error: planError } = await supabase
      .from("Plan")
      .select("id")
      .or(`stripePriceIdMonthly.eq.${priceId},stripePriceIdYearly.eq.${priceId}`)
      .single();

    if (planError || !plan) {
      return NextResponse.json(
        { error: "Plan not found for this subscription" },
        { status: 404 }
      );
    }

    // Update customer metadata with userId
    await stripe.customers.update(customerId, {
      metadata: {
        userId: authData.user.id,
      },
    });

    // Create subscription record
    const subscriptionId = authData.user.id + "-" + plan.id;
    const { error: insertError } = await supabase
      .from("Subscription")
      .insert({
        id: subscriptionId,
        userId: authData.user.id,
        planId: plan.id,
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId: customerId,
        status: stripeSubscription.status === "active" ? "active" : 
                stripeSubscription.status === "trialing" ? "trialing" :
                stripeSubscription.status === "past_due" ? "past_due" : "cancelled",
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        trialStartDate: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : null,
        trialEndDate: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
      });

    if (insertError) {
      console.error("[CREATE-ACCOUNT] Error creating subscription:", insertError);
      // Don't fail - account was created, subscription can be linked later
      return NextResponse.json({
        success: true,
        message: "Account created. Subscription linking may need to be completed later.",
        userId: authData.user.id,
      });
    }

    // Invalidate cache
    const { invalidateSubscriptionCache } = await import("@/lib/api/plans");
    await invalidateSubscriptionCache(authData.user.id);

    return NextResponse.json({ 
      success: true,
      message: "Account created and subscription linked successfully",
      userId: authData.user.id,
    });
  } catch (error) {
    console.error("[CREATE-ACCOUNT] Error:", error);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}

