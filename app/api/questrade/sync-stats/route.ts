import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function GET() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get Questrade connection
    const { data: connection } = await supabase
      .from("QuestradeConnection")
      .select("id, lastSyncedAt")
      .eq("userId", user.id)
      .single();

    if (!connection) {
      return NextResponse.json({
        accounts: 0,
        holdings: 0,
        transactions: 0,
        lastSyncedAt: null,
      });
    }

    // Get connected accounts
    const { count: accountsCount } = await supabase
      .from("InvestmentAccount")
      .select("id", { count: "exact", head: true })
      .eq("questradeConnectionId", connection.id)
      .eq("isQuestradeConnected", true);

    // Get accounts connected to this Questrade connection
    const { data: connectedAccounts } = await supabase
      .from("InvestmentAccount")
      .select("id")
      .eq("questradeConnectionId", connection.id)
      .eq("isQuestradeConnected", true);

    const accountIds = connectedAccounts?.map((acc) => acc.id) || [];

    // Count holdings (unique securities with positions)
    let holdingsCount = 0;
    if (accountIds.length > 0) {
      const { data: holdings } = await supabase
        .from("InvestmentTransaction")
        .select("securityId")
        .in("accountId", accountIds)
        .not("quantity", "is", null)
        .gt("quantity", 0);

      // Count unique securities
      const uniqueSecurities = new Set(holdings?.map((h) => h.securityId) || []);
      holdingsCount = uniqueSecurities.size;
    }

    // Count transactions
    let transactionsCount = 0;
    if (accountIds.length > 0) {
      const { count } = await supabase
        .from("InvestmentTransaction")
        .select("id", { count: "exact", head: true })
        .in("accountId", accountIds);
      transactionsCount = count || 0;
    }

    return NextResponse.json({
      accounts: accountsCount || 0,
      holdings: holdingsCount,
      transactions: transactionsCount,
      lastSyncedAt: connection.lastSyncedAt,
    });
  } catch (error: any) {
    console.error("Error fetching sync stats:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch sync stats" },
      { status: 500 }
    );
  }
}

