import { NextResponse } from "next/server";
import { makeBillingService } from "@/src/application/billing/billing.factory";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { AppError } from "@/src/application/shared/app-error";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const billingService = makeBillingService();
    const paymentMethods = await billingService.getPaymentMethods(userId);

    // Return the first payment method (or null if none)
    const paymentMethod = paymentMethods.length > 0 ? paymentMethods[0] : null;

    return NextResponse.json({
      paymentMethod: paymentMethod ? {
        id: paymentMethod.id,
        type: paymentMethod.type,
        card: paymentMethod.card || null,
      } : null,
    });
  } catch (error) {
    console.error("[PAYMENT_METHOD] Error fetching payment method:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to fetch payment method" },
      { status: 500 }
    );
  }
}

