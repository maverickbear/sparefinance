import { NextRequest, NextResponse } from "next/server";
import { makeTransactionsService } from "@/src/application/transactions/transactions.factory";
import { getCurrentUserId, guardFeatureAccess } from "@/src/application/shared/feature-guard";
import { AppError } from "@/src/application/shared/app-error";
import { TRANSACTION_IMPORT_THRESHOLD } from "@/src/domain/shared/constants";

interface ImportRequest {
  transactions: Array<{
    date: string | Date;
    type: "expense" | "income" | "transfer";
    amount: number;
    accountId: string;
    toAccountId?: string;
    categoryId?: string | null;
    subcategoryId?: string | null;
    description?: string | null;
    recurring?: boolean;
    expenseType?: "fixed" | "variable" | null;
    rowIndex?: number;
    fileName?: string;
  }>;
}

/**
 * POST /api/v2/transactions/import
 * Import multiple transactions (for CSV import)
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has access to CSV import
    const featureGuard = await guardFeatureAccess(userId, "hasCsvImport");
    if (!featureGuard.allowed) {
      return NextResponse.json(
        { 
          error: featureGuard.error?.message || "CSV import is not available in your current plan",
          code: featureGuard.error?.code,
          planError: featureGuard.error,
        },
        { status: 403 }
      );
    }

    const body: ImportRequest = await request.json();
    const { transactions } = body;

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json(
        { error: "No transactions provided" },
        { status: 400 }
      );
    }

    // For large imports, create a background job
    if (transactions.length >= TRANSACTION_IMPORT_THRESHOLD) {
      // Get accountId from first transaction (all should have same accountId for CSV import)
      const accountId = transactions[0]?.accountId;
      if (!accountId) {
        return NextResponse.json(
          { error: "Missing accountId in transactions" },
          { status: 400 }
        );
      }

      // Create import job using service
      const service = makeTransactionsService();
      const jobId = await service.createImportJob(userId, accountId, transactions);

      // Initialize progress tracker
      const { progressTracker } = await import("@/src/infrastructure/utils/progress-tracker");
      progressTracker.create(jobId, transactions.length, `Queued ${transactions.length} transactions for import...`);

      // Process in background (fire and forget)
      service.importTransactions(userId, transactions, jobId).catch(error => {
        const { progressTracker } = require("@/src/infrastructure/utils/progress-tracker");
        progressTracker.error(jobId, error instanceof Error ? error.message : "Unknown error");
        console.error("[IMPORT] Background import failed:", error);
      });

      return NextResponse.json({
        success: true,
        jobId: jobId,
        message: `Import queued for background processing. ${transactions.length} transactions will be imported.`,
      });
    }

    // Small imports: process immediately using service
    const service = makeTransactionsService();
    const result = await service.importTransactions(userId, transactions);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error in transaction import:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Failed to import transactions",
      },
      { status: 500 }
    );
  }
}

