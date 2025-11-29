import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { suggestCategory } from "@/src/application/shared/category-learning";
import { formatTimestamp } from "@/src/infrastructure/utils/timestamp";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all transactions without category for this user
    const { data: transactions, error: fetchError } = await supabase
      .from("Transaction")
      .select("id, description, amount, type, userId")
      .eq("userId", user.id)
      .is("categoryId", null)
      .is("suggestedCategoryId", null) // Only process transactions without suggestions
      .not("description", "is", null)
      .order("date", { ascending: false })
      .limit(100); // Process up to 100 transactions at a time

    if (fetchError) {
      console.error("Error fetching transactions:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch transactions" },
        { status: 500 }
      );
    }

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ 
        processed: 0,
        message: "No transactions to process" 
      });
    }

    let processed = 0;
    let errors = 0;

    // Process each transaction
    for (const tx of transactions) {
      try {
        if (!tx.description) continue;

        // Get category suggestion
        const suggestion = await suggestCategory(
          tx.userId,
          tx.description,
          tx.amount,
          tx.type
        );

        if (suggestion) {
          // Update transaction with suggestion
          const { error: updateError } = await supabase
            .from("Transaction")
            .update({
              suggestedCategoryId: suggestion.categoryId,
              suggestedSubcategoryId: suggestion.subcategoryId || null,
              updatedAt: formatTimestamp(new Date()),
            })
            .eq("id", tx.id);

          if (updateError) {
            console.error(`Error updating transaction ${tx.id}:`, updateError);
            errors++;
          } else {
            processed++;
            console.log(`Generated suggestion for transaction ${tx.id}:`, {
              suggestedCategoryId: suggestion.categoryId,
              confidence: suggestion.confidence,
              matchCount: suggestion.matchCount,
            });
          }
        }
      } catch (error) {
        console.error(`Error processing transaction ${tx.id}:`, error);
        errors++;
      }
    }

    return NextResponse.json({
      processed,
      errors,
      total: transactions.length,
      message: `Processed ${processed} transactions, ${errors} errors`,
    });
  } catch (error) {
    console.error("Error generating suggestions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

