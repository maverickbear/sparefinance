import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { getCurrentUserId } from "@/lib/api/feature-guard";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createServerClient();

    // Get Questrade connection
    const { data: connection, error: connectionError } = await supabase
      .from("QuestradeConnection")
      .select("*")
      .eq("userId", userId)
      .maybeSingle();

    if (connectionError || !connection) {
      return NextResponse.json({
        connection: null,
        accounts: [],
        securities: [],
        transactions: [],
      });
    }

    // Get connected accounts
    const { data: accounts } = await supabase
      .from("InvestmentAccount")
      .select("*")
      .eq("questradeConnectionId", connection.id)
      .eq("isQuestradeConnected", true)
      .order("createdAt", { ascending: false });

    const accountIds = accounts?.map((acc) => acc.id) || [];

    // Get transactions if we have accounts
    let transactions: any[] = [];
    if (accountIds.length > 0) {
      const { data: transactionsData } = await supabase
        .from("InvestmentTransaction")
        .select(`
          *,
          security:Security(*),
          account:Account(name)
        `)
        .in("accountId", accountIds)
        .order("date", { ascending: false })
        .limit(100);
      
      transactions = transactionsData || [];
    }

    // Get unique securities from transactions
    const securityIds = new Set<string>();
    transactions.forEach((tx) => {
      if (tx.securityId) {
        securityIds.add(tx.securityId);
      }
    });

    // Get all securities if we have any
    let securities: any[] = [];
    if (securityIds.size > 0) {
      const { data: securitiesData } = await supabase
        .from("Security")
        .select("*")
        .in("id", Array.from(securityIds))
        .order("symbol", { ascending: true });
      
      securities = securitiesData || [];
    }

    // Get positions if we have accounts
    let positions: any[] = [];
    if (accountIds.length > 0) {
      const { data: positionsData } = await supabase
        .from("Position")
        .select(`
          *,
          security:Security(*),
          account:InvestmentAccount(name, questradeAccountNumber)
        `)
        .in("accountId", accountIds)
        .order("lastUpdatedAt", { ascending: false });
      
      positions = positionsData || [];
    }

    return NextResponse.json({
      connection,
      accounts: accounts || [],
      securities: securities || [],
      positions: positions || [],
      transactions: transactions || [],
    });
  } catch (error: any) {
    console.error("Error fetching Questrade data:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch Questrade data" },
      { status: 500 }
    );
  }
}

