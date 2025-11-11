import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import {
  syncQuestradeAccounts,
  syncQuestradeBalances,
  syncQuestradeHoldings,
  syncQuestradeTransactions,
  syncQuestradeOrders,
  syncQuestradeExecutions,
} from "@/lib/api/questrade/sync";
import { getCurrentUserId, guardFeatureAccess, throwIfNotAllowed } from "@/lib/api/feature-guard";

export async function POST(req: NextRequest) {
  try {
    // Get current user
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has access to investments
    const guardResult = await guardFeatureAccess(userId, "hasInvestments");
    await throwIfNotAllowed(guardResult);

    // Parse request body
    const body = await req.json();
    const { accountId, syncAccounts, syncHoldings, syncTransactions, syncOrders, syncExecutions, startTime, endTime, stateFilter } = body;

    const supabase = await createServerClient();

    // Get Questrade connection
    const { data: connection, error: connectionError } = await supabase
      .from("QuestradeConnection")
      .select("id")
      .eq("userId", userId)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: "Questrade connection not found" },
        { status: 404 }
      );
    }

    const results: any = {
      accounts: { synced: 0, errors: 0 },
      balances: { synced: 0, errors: 0 },
      holdings: { synced: 0, errors: 0 },
      transactions: { synced: 0, skipped: 0, errors: 0 },
      orders: { synced: 0, errors: 0 },
      executions: { synced: 0, errors: 0 },
    };

    // Sync accounts if requested
    if (syncAccounts !== false) {
      try {
        const accountsResult = await syncQuestradeAccounts(connection.id, userId);
        results.accounts = accountsResult;
      } catch (error: any) {
        console.error("Error syncing accounts:", error);
        results.accounts.errors++;
      }
    }

    // Sync balances if requested (after accounts are synced)
    if (syncAccounts !== false) {
      try {
        const balancesResult = await syncQuestradeBalances(
          connection.id,
          userId,
          accountId
        );
        results.balances = balancesResult;
      } catch (error: any) {
        console.error("Error syncing balances:", error);
        results.balances.errors++;
      }
    }

    // Sync holdings if requested
    if (syncHoldings !== false) {
      try {
        const holdingsResult = await syncQuestradeHoldings(
          connection.id,
          userId,
          accountId
        );
        results.holdings = holdingsResult;
      } catch (error: any) {
        console.error("Error syncing holdings:", error);
        results.holdings.errors++;
      }
    }

    // Sync transactions if requested
    if (syncTransactions !== false) {
      try {
        const transactionsResult = await syncQuestradeTransactions(
          connection.id,
          userId,
          accountId,
          startTime,
          endTime
        );
        results.transactions = transactionsResult;
      } catch (error: any) {
        console.error("Error syncing transactions:", error);
        results.transactions.errors++;
      }
    }

    // Sync orders if requested
    if (syncOrders !== false) {
      try {
        const ordersResult = await syncQuestradeOrders(
          connection.id,
          userId,
          accountId,
          stateFilter
        );
        results.orders = ordersResult;
      } catch (error: any) {
        console.error("Error syncing orders:", error);
        results.orders.errors++;
      }
    }

    // Sync executions if requested
    if (syncExecutions !== false) {
      try {
        const executionsResult = await syncQuestradeExecutions(
          connection.id,
          userId,
          accountId,
          startTime,
          endTime
        );
        results.executions = executionsResult;
      } catch (error: any) {
        console.error("Error syncing executions:", error);
        results.executions.errors++;
      }
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error: any) {
    console.error("Error syncing Questrade data:", error);

    // Check if it's a plan error
    if (error.planError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          planError: error.planError,
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to sync Questrade data" },
      { status: 500 }
    );
  }
}

