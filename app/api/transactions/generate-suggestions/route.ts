import { NextRequest, NextResponse } from "next/server";
import { makeTransactionsService } from "@/src/application/transactions/transactions.factory";
import { AppError } from "@/src/application/shared/app-error";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";

/**
 * @deprecated Use /api/v2/transactions/suggestions/generate instead
 * POST /api/transactions/generate-suggestions
 * Generate category suggestions for uncategorized transactions
 * Note: This is an auxiliary route for background processing.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const service = makeTransactionsService();
    const result = await service.generateSuggestions(userId, 100);

    return NextResponse.json({
      processed: result.processed,
      errors: result.errors,
      total: result.total,
      message: `Processed ${result.processed} transactions, ${result.errors} errors`,
    });
  } catch (error) {
    console.error("Error generating suggestions:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

