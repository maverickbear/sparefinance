import { NextRequest, NextResponse } from "next/server";
import { updateTransaction } from "@/lib/api/transactions";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { formatTimestamp } from "@/src/infrastructure/utils/timestamp";
import { requireTransactionOwnership } from "@/src/infrastructure/utils/security";

/**
 * Apply suggested category to a transaction
 * This endpoint moves the suggested category to the actual category
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Verify ownership
    await requireTransactionOwnership(id);
    
    const supabase = await createServerClient();
    
    // Get the transaction to check for suggested category
    const { data: transaction, error: fetchError } = await supabase
      .from("Transaction")
      .select("suggestedCategoryId, suggestedSubcategoryId")
      .eq("id", id)
      .single();
    
    if (fetchError || !transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }
    
    if (!transaction.suggestedCategoryId) {
      return NextResponse.json(
        { error: "No suggested category found for this transaction" },
        { status: 400 }
      );
    }
    
    // Apply the suggestion by moving it to the actual category
    const updateData = {
      categoryId: transaction.suggestedCategoryId,
      subcategoryId: transaction.suggestedSubcategoryId || null,
      suggestedCategoryId: null,
      suggestedSubcategoryId: null,
    };
    
    const updatedTransaction = await updateTransaction(id, updateData);
    
    return NextResponse.json(updatedTransaction, { status: 200 });
  } catch (error) {
    console.error("Error applying suggestion:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Failed to apply suggestion";
    const statusCode = errorMessage.includes("Unauthorized") || errorMessage.includes("not found") ? 401 : 400;
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

