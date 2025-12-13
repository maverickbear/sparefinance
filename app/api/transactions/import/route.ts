/**
 * @deprecated Use /api/v2/transactions/import instead
 */
import { NextRequest, NextResponse } from "next/server";
import { makeTransactionsService } from "@/src/application/transactions/transactions.factory";
import { getCurrentUserId, guardFeatureAccess } from "@/src/application/shared/feature-guard";
import { AppError } from "@/src/application/shared/app-error";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";

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

    const TRANSACTION_THRESHOLD = 20;

    // For large imports (>= 20 transactions), create a background job
    if (transactions.length >= TRANSACTION_THRESHOLD) {
      const supabase = await createServerClient();
      
      // Get accountId from first transaction (all should have same accountId for CSV import)
      const accountId = transactions[0]?.accountId;
      if (!accountId) {
        return NextResponse.json(
          { error: "Missing accountId in transactions" },
          { status: 400 }
        );
      }

      // Create import job
      const jobId = crypto.randomUUID();
      const { error: jobError } = await supabase
        .from('system.importJobs')
        .insert({
          id: jobId,
          userId: userId,
          accountId: accountId,
          type: 'csv_import',
          status: 'pending',
          totalItems: transactions.length,
          metadata: {
            transactions: transactions.map(tx => ({
              date: tx.date instanceof Date ? tx.date.toISOString() : tx.date,
              type: tx.type,
              amount: tx.amount,
              accountId: tx.accountId,
              toAccountId: tx.toAccountId,
              categoryId: tx.categoryId || null,
              subcategoryId: tx.subcategoryId || null,
              description: tx.description || null,
              recurring: tx.recurring || false,
              expenseType: tx.expenseType || null,
              rowIndex: tx.rowIndex,
              fileName: tx.fileName,
            })),
          },
        });

      if (jobError) {
        console.error('Error creating import job:', jobError);
        return NextResponse.json(
          { error: "Failed to create import job" },
          { status: 500 }
        );
      }

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

