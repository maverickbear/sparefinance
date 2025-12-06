import { NextRequest, NextResponse } from "next/server";
import { makeTransactionsService } from "@/src/application/transactions/transactions.factory";
import { AppError } from "@/src/application/shared/app-error";

/**
 * @deprecated Use /api/v2/transactions/[id]/suggestions/apply instead
 * POST /api/transactions/[id]/apply-suggestion
 * Apply suggested category to a transaction
 * This endpoint moves the suggested category to the actual category
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const service = makeTransactionsService();
    const updatedTransaction = await service.applySuggestion(id);
    
    return NextResponse.json(updatedTransaction, { status: 200 });
  } catch (error) {
    console.error("Error applying suggestion:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to apply suggestion" },
      { status: 500 }
    );
  }
}

