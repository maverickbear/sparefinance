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
      return NextResponse.json({ executions: [] });
    }

    // Get connected accounts
    const { data: accounts } = await supabase
      .from("InvestmentAccount")
      .select("id")
      .eq("questradeConnectionId", connection.id)
      .eq("isQuestradeConnected", true)
      .eq("userId", userId);

    const accountIds = accounts?.map((acc) => acc.id) || [];

    // Get executions if we have accounts
    let executions: any[] = [];
    if (accountIds.length > 0) {
      const { data: executionsData } = await supabase
        .from("Execution")
        .select(`
          *,
          account:InvestmentAccount(name, questradeAccountNumber),
          security:Security(symbol, name)
        `)
        .in("accountId", accountIds)
        .order("timestamp", { ascending: false })
        .limit(100);
      
      executions = executionsData || [];
    }

    return NextResponse.json({ executions });
  } catch (error: any) {
    console.error("Error fetching executions:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch executions" },
      { status: 500 }
    );
  }
}

