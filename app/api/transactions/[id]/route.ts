import { NextRequest, NextResponse } from "next/server";
import { updateTransaction, deleteTransaction } from "@/lib/api/transactions";
import { TransactionFormData } from "@/lib/validations/transaction";
import { ZodError } from "zod";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data: Partial<TransactionFormData> = await request.json();
    
    const transaction = await updateTransaction(id, data);
    
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

