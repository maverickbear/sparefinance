import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceRoleClient } from "@/src/infrastructure/database/supabase-server";
import { validatePasswordAgainstHIBP } from "@/lib/utils/hibp";
import { getActiveHouseholdId } from "@/lib/utils/household";
import { formatTimestamp } from "@/src/infrastructure/utils/timestamp";
import { randomUUID } from "crypto";
import Stripe from "stripe";
import { revalidateTag } from "next/cache";

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
    // Use regular client for auth.signUp (needs to create session)
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

    // Create user profile and household using AuthService
    const { makeAuthService } = await import("@/src/application/auth/auth.factory");
    const authService = makeAuthService();
    
    let userData: any = null;
    let householdId: string | null = null;
    
    try {
      const setupResult = await authService.createAccountAndSetup({
        userId: authData.user.id,
        email: authData.user.email!,
        name: name || null,
      });
      
      userData = setupResult.user;
      householdId = setupResult.householdId || null;
    } catch (setupError) {
      console.error("[CREATE-ACCOUNT] Error setting up account:", setupError);
      // User is created in auth but not in User table - this is OK, will be created on first login
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

    // Use service role client for subscription operations (infrastructure layer)
    const serviceRoleClient = createServiceRoleClient();

    // Find plan by price ID (using service role client)
    const { data: plan, error: planError } = await serviceRoleClient
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

    // Update customer with email, name, and metadata
    await stripe.customers.update(customerId, {
      email: authData.user.email!,
      name: name || undefined,
      metadata: {
        userId: authData.user.id,
      },
    });

    // Check if there's a pending subscription created by webhook (before user signed up)
    const subscriptionId = authData.user.id + "-" + plan.id;
    
    // First, check if there's a pending subscription with this customerId (created by webhook)
    // Use service role client to bypass RLS
    const { data: pendingSubByCustomer } = await serviceRoleClient
      .from("Subscription")
      .select("id, userId")
      .eq("stripeCustomerId", customerId)
      .is("userId", null)
      .maybeSingle();
    
    // Also check by pendingEmail (in case customerId doesn't match)
    const { data: pendingSubByEmail } = await serviceRoleClient
      .from("Subscription")
      .select("id, userId")
      .eq("pendingEmail", authData.user.email!.toLowerCase())
      .is("userId", null)
      .maybeSingle();
    
    // Also check by stripeSubscriptionId
    const { data: existingSubByStripeId } = await serviceRoleClient
      .from("Subscription")
      .select("id, userId")
      .eq("stripeSubscriptionId", stripeSubscription.id)
      .maybeSingle();
    
    // Prefer pending subscription by customerId, then by email, then by stripeSubscriptionId
    const existingSub = pendingSubByCustomer || pendingSubByEmail || existingSubByStripeId;
    
    // Use householdId from setup result or fetch it
    if (!householdId) {
      householdId = await getActiveHouseholdId(authData.user.id);
    }
    
    if (!householdId) {
      console.error("[CREATE-ACCOUNT] No active household found for user:", authData.user.id);
      // Don't fail - subscription can be linked later when household is available
      return NextResponse.json({
        success: true,
        message: "Account created. Subscription linking may need to be completed later.",
        userId: authData.user.id,
      });
    }
    
    const subscriptionData: any = {
      id: subscriptionId,
      userId: authData.user.id,
      householdId: householdId, // Link to active household
      planId: plan.id,
      stripeSubscriptionId: stripeSubscription.id,
      stripeCustomerId: customerId,
      status: stripeSubscription.status === "active" ? "active" : 
              stripeSubscription.status === "trialing" ? "trialing" :
              stripeSubscription.status === "past_due" ? "past_due" : "cancelled",
      currentPeriodStart: new Date((stripeSubscription as any).current_period_start * 1000),
      currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000),
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      trialStartDate: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : null,
      trialEndDate: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
      pendingEmail: null, // Clear pending email when linking
      updatedAt: new Date(),
    };

    if (existingSub) {
      // Update existing subscription (could be pending from webhook or already linked)
      if (existingSub.id !== subscriptionId) {
        // If the ID is different (e.g., pending subscription), delete old and create new with correct ID
        console.log("[CREATE-ACCOUNT] Updating subscription with different ID:", {
          oldId: existingSub.id,
          newId: subscriptionId,
        });
        
        const { error: deleteError } = await serviceRoleClient
          .from("Subscription")
          .delete()
          .eq("id", existingSub.id);
        
        if (deleteError) {
          console.error("[CREATE-ACCOUNT] Error deleting old subscription:", deleteError);
        }
        
        // Insert new subscription with correct ID using service role client
        const { error: insertError } = await serviceRoleClient
          .from("Subscription")
          .insert(subscriptionData);
        
        if (insertError) {
          console.error("[CREATE-ACCOUNT] Error creating subscription after deleting old one:", insertError);
          return NextResponse.json({
            success: true,
            message: "Account created. Subscription linking may need to be completed later.",
            userId: authData.user.id,
          });
        }
        
        console.log("[CREATE-ACCOUNT] Subscription updated from pending to linked:", subscriptionId);
      } else {
        // Same ID, just update using service role client
        const { error: updateError } = await serviceRoleClient
          .from("Subscription")
          .update(subscriptionData)
          .eq("id", subscriptionId);
        
        if (updateError) {
          console.error("[CREATE-ACCOUNT] Error updating subscription:", updateError);
          return NextResponse.json({
            success: true,
            message: "Account created. Subscription linking may need to be completed later.",
            userId: authData.user.id,
          });
        }
        
        console.log("[CREATE-ACCOUNT] Subscription updated successfully:", subscriptionId);
        
        // Invalidate cache using tag groups
        revalidateTag('subscriptions', 'max');
        revalidateTag('accounts', 'max');
      }
    } else {
      // No existing subscription, create new one using service role client
      const { error: insertError } = await serviceRoleClient
        .from("Subscription")
        .insert(subscriptionData);

      if (insertError) {
        console.error("[CREATE-ACCOUNT] Error creating subscription:", insertError);
        // Don't fail - account was created, subscription can be linked later
        return NextResponse.json({
          success: true,
          message: "Account created. Subscription linking may need to be completed later.",
          userId: authData.user.id,
        });
      }
      
      console.log("[CREATE-ACCOUNT] Subscription created successfully:", subscriptionId);
      
      // Invalidate cache using tag groups
      revalidateTag('subscriptions', 'max');
      revalidateTag('accounts', 'max');
      
      // Send welcome email when subscription is created
      if (authData.user.email) {
        try {
          const { sendWelcomeEmail } = await import("@/lib/utils/email");
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sparefinance.com/";
          
          await sendWelcomeEmail({
            to: authData.user.email,
            userName: "", // Not used anymore, but keeping for interface compatibility
            founderName: "Naor Tartarotti",
            appUrl: appUrl,
          });
          
          console.log("[CREATE-ACCOUNT] ✅ Welcome email sent successfully to:", authData.user.email);
        } catch (welcomeEmailError) {
          console.error("[CREATE-ACCOUNT] ❌ Error sending welcome email:", welcomeEmailError);
          // Don't fail account creation if welcome email fails
        }
      }
    }

    // Invalidate cache

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

