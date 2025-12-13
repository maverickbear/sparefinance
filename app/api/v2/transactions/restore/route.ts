import { NextRequest, NextResponse } from "next/server";
import { makeTransactionsService } from "@/src/application/transactions/transactions.factory";
import { AppError } from "@/src/application/shared/app-error";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { revalidateTag } from 'next/cache';

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "Invalid request: ids must be a non-empty array" },
        { status: 400 }
      );
    }

    const service = makeTransactionsService();
    await service.restoreTransactions(ids);

    // Invalidate cache
    revalidateTag(`transactions-${userId}`, 'max');
    revalidateTag(`dashboard-${userId}`, 'max');
    revalidateTag(`reports-${userId}`, 'max');

    return NextResponse.json({ success: true, restored: ids.length }, { status: 200 });
  } catch (error) {
    console.error("Error restoring transactions:", error);

    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to restore transactions" },
      { status: 500 }
    );
  }
}
