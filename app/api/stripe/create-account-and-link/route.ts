import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { validatePasswordAgainstHIBP } from "@/lib/utils/hibp";
import { AppError } from "@/src/application/shared/app-error";
import { makeStripeService } from "@/src/application/stripe/stripe.factory";
import { makeAuthService } from "@/src/application/auth/auth.factory";
import { logger } from "@/src/infrastructure/utils/logger";
import { revalidateTag } from "next/cache";

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
    const authService = makeAuthService();
    
    try {
      await authService.createAccountAndSetup({
        userId: authData.user.id,
        email: authData.user.email!,
        name: name || null,
      });
    } catch (setupError) {
      logger.error("[CREATE-ACCOUNT] Error setting up account:", setupError);
      // User is created in auth but not in User table - this is OK, will be created on first login
    }

    // Link subscription using StripeService
    const stripeService = makeStripeService();
    const linkResult = await stripeService.linkSubscriptionToNewAccount(
      authData.user.id,
      customerId,
      email,
      name
    );

    // Send welcome email when subscription is successfully linked
    if (linkResult.success && authData.user.email) {
      try {
        const { sendWelcomeEmail } = await import("@/lib/utils/email");
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sparefinance.com/";
        
        await sendWelcomeEmail({
          to: authData.user.email,
          userName: "", // Not used anymore, but keeping for interface compatibility
          founderName: "Naor Tartarotti",
          appUrl: appUrl,
        });
        
        logger.info("[CREATE-ACCOUNT] Welcome email sent successfully to:", authData.user.email);
      } catch (welcomeEmailError) {
        logger.error("[CREATE-ACCOUNT] Error sending welcome email:", welcomeEmailError);
        // Don't fail account creation if welcome email fails
      }
    }

    const userId = linkResult.userId || authData.user.id;
    revalidateTag('subscriptions', 'max');
    revalidateTag('accounts', 'max');
    revalidateTag(`dashboard-${userId}`, 'max');
    revalidateTag(`reports-${userId}`, 'max');

    return NextResponse.json({ 
      success: linkResult.success,
      message: linkResult.message,
      userId: linkResult.userId || authData.user.id,
    });
  } catch (error) {
    logger.error("[CREATE-ACCOUNT] Error:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}

