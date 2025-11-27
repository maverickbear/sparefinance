import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { getTransactionAmount, decryptDescription } from "@/lib/utils/transaction-encryption";

/**
 * POST /api/transactions/by-ids
 * Get transactions by their IDs
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "ids must be a non-empty array" },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Fetch transactions by IDs
    const { data: transactions, error } = await supabase
      .from("Transaction")
      .select(`
        id,
        date,
        amount,
        description,
        accountId,
        account:Account(id, name)
      `)
      .in("id", ids)
      .order("date", { ascending: false });

    if (error) {
      console.error("Error fetching transactions:", error);
      return NextResponse.json(
        { error: "Failed to fetch transactions" },
        { status: 500 }
      );
    }

    // Decrypt descriptions and format amounts
    interface TransactionWithAccount {
      id: string;
      date: string;
      amount: number | string;
      description: string | null;
      account: { id: string; name: string } | { id: string; name: string }[] | null;
    }

    const formattedTransactions = (transactions || []).map((tx: TransactionWithAccount) => ({
      id: tx.id,
      date: tx.date,
      amount: getTransactionAmount(tx.amount) ?? 0,
      description: decryptDescription(tx.description),
      account: Array.isArray(tx.account) ? tx.account[0] : tx.account,
    }));

    return NextResponse.json(formattedTransactions);
  } catch (error) {
    console.error("Error in POST /api/transactions/by-ids:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


