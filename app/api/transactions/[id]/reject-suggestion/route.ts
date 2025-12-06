/**
 * @deprecated Use /api/v2/transactions/[id]/suggestions/reject instead
 */
import { NextRequest, NextResponse } from "next/server";
import { makeTransactionsService } from "@/src/application/transactions/transactions.factory";
import { AppError } from "@/src/application/shared/app-error";

/**
 * Reject suggested category for a transaction
 * This endpoint removes the suggested category, allowing user to manually select
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const service = makeTransactionsService();
    const updatedTransaction = await service.rejectSuggestion(id);
    
    return NextResponse.json(updatedTransaction, { status: 200 });
  } catch (error) {
    console.error("Error rejecting suggestion:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    const errorMessage = error instanceof Error ? error.message : "Failed to reject suggestion";
    const statusCode = errorMessage.includes("Unauthorized") || errorMessage.includes("not found") ? 401 : 400;
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

