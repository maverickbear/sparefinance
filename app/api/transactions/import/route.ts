import { NextRequest, NextResponse } from "next/server";
import { createTransaction } from "@/lib/api/transactions";
import { TransactionFormData, transactionSchema } from "@/src/domain/transactions/transactions.validations";
import { ZodError } from "zod";
import { getCurrentUserId, guardFeatureAccess } from "@/src/application/shared/feature-guard";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { formatTimestamp } from "@/src/infrastructure/utils/timestamp";

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
        .from('ImportJob')
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

    // Small imports: process immediately
    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ rowIndex: number; fileName?: string; error: string }> = [];

    // Process transactions in batches to avoid rate limiting
    const batchSize = 20;
    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize);
      
      // Process batch with a small delay between batches to avoid rate limiting
      await Promise.allSettled(
        batch.map(async (tx) => {
          try {
            // Convert date string to Date object if needed
            const data: TransactionFormData = {
              date: tx.date instanceof Date ? tx.date : new Date(tx.date),
              type: tx.type,
              amount: tx.amount,
              accountId: tx.accountId,
              toAccountId: tx.toAccountId,
              categoryId: tx.categoryId || undefined,
              subcategoryId: tx.subcategoryId || undefined,
              description: tx.description || undefined,
              recurring: tx.recurring || false,
              expenseType: tx.expenseType || undefined,
            };
            
            // Validate with schema
            const validatedData = transactionSchema.parse(data);
            
            await createTransaction(validatedData);
            successCount++;
          } catch (error) {
            errorCount++;
            let errorMessage = "Unknown error";
            
            if (error instanceof ZodError) {
              errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
            } else if (error instanceof Error) {
              errorMessage = error.message;
            }
            
            errors.push({
              rowIndex: tx.rowIndex || 0,
              fileName: tx.fileName,
              error: errorMessage,
            });
            console.error("Error importing transaction:", error);
          }
        })
      );

      // Add a small delay between batches to avoid rate limiting
      if (i + batchSize < transactions.length) {
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay between batches
      }
    }

    return NextResponse.json({
      success: true,
      imported: successCount,
      errors: errorCount,
      errorDetails: errors,
    });
  } catch (error) {
    console.error("Error in transaction import:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Failed to import transactions",
      },
      { status: 500 }
    );
  }
}

