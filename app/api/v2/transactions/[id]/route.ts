import { NextRequest, NextResponse } from "next/server";
import { makeTransactionsService } from "@/src/application/transactions/transactions.factory";
import { TransactionFormData } from "@/src/domain/transactions/transactions.validations";
import { ZodError } from "zod";
import { getCurrentUserId, guardWriteAccess, throwIfNotAllowed } from "@/src/application/shared/feature-guard";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const service = makeTransactionsService();
    const transaction = await service.getTransactionById(id);
    
    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(transaction, { status: 200 });
  } catch (error) {
    console.error("Error fetching transaction:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch transaction" },
      { status: 500 }
    );
  }
}

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
    const body = await request.json();
    
    // Handle date conversion
    const data: Partial<TransactionFormData> = {
      ...body,
      date: body.date ? (body.date instanceof Date ? body.date : new Date(body.date + 'T00:00:00')) : undefined,
    };
    
    const service = makeTransactionsService();
    const transaction = await service.updateTransaction(id, data);
    
    return NextResponse.json(transaction, { status: 200 });
  } catch (error) {
    console.error("Error updating transaction:", error);
    
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
    
    const service = makeTransactionsService();
    await service.deleteTransaction(id);
    
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting transaction:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete transaction" },
      { status: 400 }
    );
  }
}

