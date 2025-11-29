import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "../../../../src/infrastructure/database/supabase-server";
import { formatTimestamp } from "../../../../src/infrastructure/utils/timestamp";
import { requireTransactionOwnership } from "../../../../src/infrastructure/utils/security";

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
    
    // Verify ownership
    await requireTransactionOwnership(id);
    
    const supabase = await createServerClient();
    
    // Get the transaction to check for suggested category
    const { data: transaction, error: fetchError } = await supabase
      .from("Transaction")
      .select("suggestedCategoryId")
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
    
    // Remove the suggestion
    const { data: updatedTransaction, error: updateError } = await supabase
      .from("Transaction")
      .update({
        suggestedCategoryId: null,
        suggestedSubcategoryId: null,
        updatedAt: formatTimestamp(new Date()),
      })
      .eq("id", id)
      .select()
      .single();
    
    if (updateError) {
      console.error("Error rejecting suggestion:", updateError);
      return NextResponse.json(
        { error: "Failed to reject suggestion" },
        { status: 400 }
      );
    }
    
    return NextResponse.json(updatedTransaction, { status: 200 });
  } catch (error) {
    console.error("Error rejecting suggestion:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Failed to reject suggestion";
    const statusCode = errorMessage.includes("Unauthorized") || errorMessage.includes("not found") ? 401 : 400;
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

