import { NextRequest, NextResponse } from "next/server";
import { makeTransactionsService } from "@/src/application/transactions/transactions.factory";
import { getCurrentUserId, guardWriteAccess, throwIfNotAllowed } from "@/src/application/shared/feature-guard";
import { revalidateTag } from 'next/cache';

/**
 * DELETE /api/v2/transactions/bulk
 * Delete multiple transactions
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user can perform write operations
    const writeGuard = await guardWriteAccess(userId);
    await throwIfNotAllowed(writeGuard);

    const body = await request.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "Transaction IDs array is required" },
        { status: 400 }
      );
    }

    const service = makeTransactionsService();
    // Hard delete directly (no soft delete)
    await service.deleteMultipleTransactions(ids);
    
    // Invalidate cache
    revalidateTag(`transactions-${userId}`, 'max');
    revalidateTag(`dashboard-${userId}`, 'max');
    revalidateTag(`reports-${userId}`, 'max');
    
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting multiple transactions:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete transactions" },
      { status: 400 }
    );
  }
}

/**
 * PATCH /api/v2/transactions/bulk
 * Bulk update transactions (types or categories)
 */
export async function PATCH(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user can perform write operations
    const writeGuard = await guardWriteAccess(userId);
    await throwIfNotAllowed(writeGuard);

    const body = await request.json();
    const { transactionIds, type, categoryId, subcategoryId } = body;

    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      return NextResponse.json(
        { error: "Transaction IDs array is required" },
        { status: 400 }
      );
    }

    const service = makeTransactionsService();
    let success = 0;
    let failed = 0;

    // Update each transaction
    for (const id of transactionIds) {
      try {
        const updateData: any = {};
        
        if (type !== undefined) {
          updateData.type = type;
          // If changing to expense, preserve expenseType if it exists
          // If changing away from expense, set expenseType to null
          if (type !== "expense") {
            updateData.expenseType = null;
          }
        }
        
        if (categoryId !== undefined) {
          updateData.categoryId = categoryId || null;
        }
        
        if (subcategoryId !== undefined) {
          updateData.subcategoryId = subcategoryId || null;
        }

        await service.updateTransaction(id, updateData);
        success++;
      } catch (error) {
        console.error(`Error updating transaction ${id}:`, error);
        failed++;
      }
    }
    
    return NextResponse.json({ success, failed }, { status: 200 });
  } catch (error) {
    console.error("Error bulk updating transactions:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to bulk update transactions" },
      { status: 400 }
    );
  }
}

