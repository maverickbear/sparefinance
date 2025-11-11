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
      .select("id")
      .eq("userId", userId)
      .maybeSingle();

    if (connectionError || !connection) {
      return NextResponse.json({ orders: [] });
    }

    // Get connected accounts
    const { data: accounts } = await supabase
      .from("InvestmentAccount")
      .select("id")
      .eq("questradeConnectionId", connection.id)
      .eq("isQuestradeConnected", true)
      .eq("userId", userId);

    const accountIds = accounts?.map((acc) => acc.id) || [];

    // Get orders if we have accounts
    let orders: any[] = [];
    if (accountIds.length > 0) {
      const { data: ordersData } = await supabase
        .from("Order")
        .select(`
          *,
          account:InvestmentAccount(name, questradeAccountNumber),
          security:Security(symbol, name)
        `)
        .in("accountId", accountIds)
        .order("creationTime", { ascending: false })
        .limit(100);
      
      orders = ordersData || [];
    }

    return NextResponse.json({ orders });
  } catch (error: any) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch orders" },
      { status: 500 }
    );
  }
}

