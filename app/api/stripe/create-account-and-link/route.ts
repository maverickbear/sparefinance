import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceRoleClient } from "@/src/infrastructure/database/supabase-server";
import { validatePasswordAgainstHIBP } from "@/lib/utils/hibp";
import { getActiveHouseholdId } from "@/lib/utils/household";
import { formatTimestamp } from "@/src/infrastructure/utils/timestamp";
import { randomUUID } from "crypto";
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

    // Use service role client to bypass RLS for creating User and Subscription
    const serviceRoleClient = createServiceRoleClient();

    // Create user profile in User table using service role (bypasses RLS)
    const { data: userData, error: userError } = await serviceRoleClient
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

    // Create personal household and member record for the owner using service role (bypasses RLS)
    if (userData) {
      const now = new Date().toISOString();
      
      // Create personal household
      const { data: household, error: householdError } = await serviceRoleClient
        .from("Household")
        .insert({
          name: name || authData.user.email || "Minha Conta",
          type: "personal",
          createdBy: userData.id,
          createdAt: now,
          updatedAt: now,
          settings: {},
        })
        .select()
        .single();

      if (householdError || !household) {
        console.error("[CREATE-ACCOUNT] Error creating household:", householdError);
        // Don't fail - this is not critical
      } else {
        // Create household member (owner role)
        const { error: householdMemberError } = await serviceRoleClient
          .from("HouseholdMemberNew")
          .insert({
            householdId: household.id,
            userId: userData.id,
            role: "owner",
            status: "active",
            isDefault: true,
            joinedAt: now,
          createdAt: now,
          updatedAt: now,
        });

      if (householdMemberError) {
        console.error("[CREATE-ACCOUNT] Error creating household member:", householdMemberError);
        // Don't fail - this is not critical
        } else {
          // Set as active household
          const { error: activeError } = await serviceRoleClient
            .from("UserActiveHousehold")
            .insert({
              userId: userData.id,
              householdId: household.id,
              updatedAt: now,
            });

          if (activeError) {
            console.error("[CREATE-ACCOUNT] Error setting active household:", activeError);
          } else {
            // Create emergency fund goal for new user
            try {
              // Check if emergency fund goal already exists
              const { data: existingGoals } = await serviceRoleClient
                .from("Goal")
                .select("*")
                .eq("householdId", household.id)
                .eq("name", "Emergency Funds")
                .eq("isSystemGoal", true)
                .limit(1);

              if (!existingGoals || existingGoals.length === 0) {
                // Create emergency fund goal
                const goalId = randomUUID();
                const goalNow = formatTimestamp(new Date());
                const { error: goalError } = await serviceRoleClient
                  .from("Goal")
                  .insert({
                    id: goalId,
                    name: "Emergency Funds",
                    targetAmount: 0.00,
                    currentBalance: 0.00,
                    incomePercentage: 0.00,
                    priority: "High",
                    description: "Emergency fund for unexpected expenses",
                    isPaused: false,
                    isCompleted: false,
                    completedAt: null,
                    expectedIncome: null,
                    targetMonths: null,
                    accountId: null,
                    holdingId: null,
                    isSystemGoal: true,
                    userId: userData.id,
                    householdId: household.id,
                    createdAt: goalNow,
                    updatedAt: goalNow,
                  });

                if (goalError) {
                  console.error("[CREATE-ACCOUNT] Error creating emergency fund goal:", goalError);
                } else {
                  console.log("[CREATE-ACCOUNT] ✅ Emergency fund goal created");
                }
              }
            } catch (goalError) {
              console.error("[CREATE-ACCOUNT] Error creating emergency fund goal:", goalError);
              // Don't fail account creation if goal creation fails
            }
          }
        }
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
    
    // Get active household ID for the user (household should have been created during signup)
    const householdId = await getActiveHouseholdId(authData.user.id);
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
    const { invalidateSubscriptionCache } = await import("@/lib/api/subscription");
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

