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
      return NextResponse.json({ securities: [] });
    }

    // Get connected accounts
    const { data: accounts } = await supabase
      .from("InvestmentAccount")
      .select("id")
      .eq("questradeConnectionId", connection.id)
      .eq("isQuestradeConnected", true)
      .eq("userId", userId);

    const accountIds = accounts?.map((acc) => acc.id) || [];

    // Get securities from positions with symbolId from orders
    let securities: any[] = [];
    if (accountIds.length > 0) {
      const { data: positions } = await supabase
        .from("Position")
        .select(`
          security:Security(*)
        `)
        .in("accountId", accountIds)
        .gt("openQuantity", 0);

      if (positions) {
        // Get unique securities
        const uniqueSecurities = new Map();
        const securityIds = new Set<string>();
        
        positions.forEach((pos: any) => {
          if (pos.security && !uniqueSecurities.has(pos.security.id)) {
            uniqueSecurities.set(pos.security.id, pos.security);
            securityIds.add(pos.security.id);
          }
        });

        // Get symbolIds from orders for these securities
        const { data: orders } = await supabase
          .from("Order")
          .select("symbolId, symbol")
          .in("accountId", accountIds)
          .in("symbol", Array.from(uniqueSecurities.values()).map((s: any) => s.symbol))
          .order("creationTime", { ascending: false });

        // Map symbolId to security by symbol
        const symbolIdMap = new Map<string, number>();
        if (orders) {
          orders.forEach((order: any) => {
            if (!symbolIdMap.has(order.symbol)) {
              symbolIdMap.set(order.symbol, order.symbolId);
            }
          });
        }

        // Add symbolId to securities
        securities = Array.from(uniqueSecurities.values()).map((sec: any) => ({
          ...sec,
          symbolId: symbolIdMap.get(sec.symbol) || null,
        }));
      }
    }

    // Also get securities from transactions if no positions
    if (securities.length === 0 && accountIds.length > 0) {
      const { data: transactions } = await supabase
        .from("InvestmentTransaction")
        .select(`
          security:Security(*)
        `)
        .in("accountId", accountIds);

      if (transactions) {
        const uniqueSecurities = new Map();
        transactions.forEach((tx: any) => {
          if (tx.security && !uniqueSecurities.has(tx.security.id)) {
            uniqueSecurities.set(tx.security.id, tx.security);
          }
        });
        
        // Get symbolIds from orders
        const symbols = Array.from(uniqueSecurities.values()).map((s: any) => s.symbol);
        const { data: orders } = await supabase
          .from("Order")
          .select("symbolId, symbol")
          .in("accountId", accountIds)
          .in("symbol", symbols)
          .order("creationTime", { ascending: false });

        const symbolIdMap = new Map<string, number>();
        if (orders) {
          orders.forEach((order: any) => {
            if (!symbolIdMap.has(order.symbol)) {
              symbolIdMap.set(order.symbol, order.symbolId);
            }
          });
        }

        securities = Array.from(uniqueSecurities.values()).map((sec: any) => ({
          ...sec,
          symbolId: symbolIdMap.get(sec.symbol) || null,
        }));
      }
    }

    return NextResponse.json({ securities: securities || [] });
  } catch (error: any) {
    console.error("Error fetching securities:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch securities" },
      { status: 500 }
    );
  }
}

