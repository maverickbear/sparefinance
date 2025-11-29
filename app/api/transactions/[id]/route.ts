import { NextRequest, NextResponse } from "next/server";
import { updateTransaction, deleteTransaction } from "@/lib/api/transactions";
import { TransactionFormData } from "@/src/domain/transactions/transactions.validations";
import { ZodError } from "zod";
import { getCurrentUserId, guardWriteAccess, throwIfNotAllowed } from "@/src/application/shared/feature-guard";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user can perform write operations
    const writeGuard = await guardWriteAccess(userId);
    await throwIfNotAllowed(writeGuard);

    const { id } = await params;
    const data: Partial<TransactionFormData> = await request.json();
    
    console.log("[PATCH /api/transactions/[id]] Updating transaction:", { id, data });
    
    const transaction = await updateTransaction(id, data);
    
    console.log("[PATCH /api/transactions/[id]] Transaction updated successfully:", { id });
    
    return NextResponse.json(transaction, { status: 200 });
  } catch (error) {
    console.error("[PATCH /api/transactions/[id]] Error updating transaction:", {
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    
    // Handle validation errors
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') },
        { status: 400 }
      );
    }
    
    // Handle other errors
    const errorMessage = error instanceof Error ? error.message : "Failed to update transaction";
    const statusCode = errorMessage.includes("Unauthorized") ? 401 : 400;
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user can perform write operations
    const writeGuard = await guardWriteAccess(userId);
    await throwIfNotAllowed(writeGuard);

    const { id } = await params;
    
    await deleteTransaction(id);
    
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting transaction:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete transaction" },
      { status: 400 }
    );
  }
}

