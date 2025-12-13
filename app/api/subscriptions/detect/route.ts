import { NextRequest, NextResponse } from "next/server";
import { makeTransactionsService } from "@/src/application/transactions/transactions.factory";
import { AppError } from "@/src/application/shared/app-error";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";

/**
 * GET /api/subscriptions/detect
 * Detect subscriptions from user's transaction history
 * 
 * SIMPLIFIED: Now uses TransactionsService instead of separate SubscriptionDetectionService
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const transactionsService = makeTransactionsService();
    const detectedSubscriptions = await transactionsService.detectSubscriptions(userId);
    
    return NextResponse.json({
      success: true,
      subscriptions: detectedSubscriptions,
      count: detectedSubscriptions.length,
    });
  } catch (error) {
    console.error("Error detecting subscriptions:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          subscriptions: [],
          count: 0,
        },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to detect subscriptions",
        subscriptions: [],
        count: 0,
      },
      { status: 500 }
    );
  }
}

