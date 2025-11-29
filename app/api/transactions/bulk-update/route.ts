import { NextRequest, NextResponse } from "next/server";
import { updateTransaction } from "@/lib/api/transactions";
import { requireTransactionOwnership } from "@/src/infrastructure/utils/security";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { transactionIds, type, categoryId, subcategoryId } = body;

    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      return NextResponse.json(
        { error: "transactionIds must be a non-empty array" },
        { status: 400 }
      );
    }

    // Validate that either type or categoryId is provided
    if (!type && categoryId === undefined) {
      return NextResponse.json(
        { error: "Either 'type' or 'categoryId' must be provided" },
        { status: 400 }
      );
    }

    // Validate type if provided
    if (type && !["expense", "income", "transfer"].includes(type)) {
      return NextResponse.json(
        { error: "type must be 'expense', 'income', or 'transfer'" },
        { status: 400 }
      );
    }

    // Verify ownership of all transactions before updating
    for (const id of transactionIds) {
      await requireTransactionOwnership(id);
    }

    // Build update data
    const updateData: { type?: "income" | "expense" | "transfer"; categoryId?: string; subcategoryId?: string } = {};
    if (type && (type === "expense" || type === "income" || type === "transfer")) {
      updateData.type = type;
    }
    if (categoryId !== undefined) {
      updateData.categoryId = categoryId || undefined;
      // If categoryId is being cleared, also clear subcategoryId
      if (!categoryId) {
        updateData.subcategoryId = undefined;
      } else if (subcategoryId !== undefined) {
        updateData.subcategoryId = subcategoryId || undefined;
      }
    }

    // Update all transactions
    const results = await Promise.allSettled(
      transactionIds.map(id => updateTransaction(id, updateData))
    );

    // Check for failures
    const failures = results.filter(result => result.status === 'rejected');
    const successful = results.filter(result => result.status === 'fulfilled');

    if (failures.length > 0) {
      const errorMessages = failures.map(failure => {
        if (failure.status === 'rejected') {
          return failure.reason?.message || 'Failed to update transaction';
        }
        return 'Unknown error';
      });

      return NextResponse.json(
        {
          success: successful.length,
          failed: failures.length,
          errors: errorMessages,
        },
        { status: 207 } // Multi-Status
      );
    }

    return NextResponse.json({
      success: successful.length,
      failed: 0,
    }, { status: 200 });
  } catch (error) {
    console.error("Error bulk updating transactions:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Failed to bulk update transactions";
    const statusCode = errorMessage.includes("Unauthorized") ? 401 : 400;
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

