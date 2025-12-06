import { NextRequest, NextResponse } from "next/server";
import { makeTransactionsService } from "@/src/application/transactions/transactions.factory";
import { AppError } from "@/src/application/shared/app-error";

/**
 * POST /api/transactions/by-ids
 * @deprecated Use /api/v2/transactions/by-ids instead
 * Get transactions by their IDs
 * Note: This is an auxiliary route. Consider using TransactionsService.getTransactions() with filters instead.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids } = body;

    const service = makeTransactionsService();
    const transactions = await service.getTransactionsByIds(ids);

    return NextResponse.json(transactions);
  } catch (error) {
    console.error("Error in POST /api/transactions/by-ids:", error);
    
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
