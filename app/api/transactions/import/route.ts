import { NextRequest, NextResponse } from "next/server";
import { createTransaction } from "@/lib/api/transactions";
import { TransactionFormData, transactionSchema } from "@/lib/validations/transaction";
import { ZodError } from "zod";

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
    const body: ImportRequest = await request.json();
    const { transactions } = body;

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json(
        { error: "No transactions provided" },
        { status: 400 }
      );
    }

    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ rowIndex: number; fileName?: string; error: string }> = [];

    // Process transactions in batches to avoid rate limiting
    const batchSize = 20; // Increased batch size
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

