import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { getCurrentUserId } from "@/lib/api/feature-guard";

/**
 * API route to silently check if there are new data updates
 * Returns a hash/timestamp that changes when any relevant data is updated
 * This allows the frontend to poll silently without fetching all data
 */
export async function GET(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createServerClient();
    const { searchParams } = new URL(request.url);
    const lastCheck = searchParams.get("lastCheck"); // ISO timestamp from client

    // Get the most recent update timestamps from all relevant tables
    // Use a more efficient approach: get max timestamp from each table
    const checks = await Promise.all([
      // Check transactions - get max of updatedAt and createdAt
      supabase
        .from("Transaction")
        .select("updatedAt, createdAt")
        .order("updatedAt", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error || !data) return null;
          const updated = data.updatedAt ? new Date(data.updatedAt).getTime() : 0;
          const created = data.createdAt ? new Date(data.createdAt).getTime() : 0;
          return Math.max(updated, created);
        })
        .catch(() => null),

      // Check accounts
      supabase
        .from("Account")
        .select("updatedAt, createdAt")
        .order("updatedAt", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error || !data) return null;
          const updated = data.updatedAt ? new Date(data.updatedAt).getTime() : 0;
          const created = data.createdAt ? new Date(data.createdAt).getTime() : 0;
          return Math.max(updated, created);
        })
        .catch(() => null),

      // Check budgets
      supabase
        .from("Budget")
        .select("updatedAt, createdAt")
        .order("updatedAt", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error || !data) return null;
          const updated = data.updatedAt ? new Date(data.updatedAt).getTime() : 0;
          const created = data.createdAt ? new Date(data.createdAt).getTime() : 0;
          return Math.max(updated, created);
        })
        .catch(() => null),

      // Check goals
      supabase
        .from("Goal")
        .select("updatedAt, createdAt")
        .order("updatedAt", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error || !data) return null;
          const updated = data.updatedAt ? new Date(data.updatedAt).getTime() : 0;
          const created = data.createdAt ? new Date(data.createdAt).getTime() : 0;
          return Math.max(updated, created);
        })
        .catch(() => null),

      // Check debts
      supabase
        .from("Debt")
        .select("updatedAt, createdAt")
        .order("updatedAt", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error || !data) return null;
          const updated = data.updatedAt ? new Date(data.updatedAt).getTime() : 0;
          const created = data.createdAt ? new Date(data.createdAt).getTime() : 0;
          return Math.max(updated, created);
        })
        .catch(() => null),

      // Check investment entries (SimpleInvestmentEntry)
      supabase
        .from("SimpleInvestmentEntry")
        .select("updatedAt, createdAt")
        .order("updatedAt", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error || !data) return null;
          const updated = data.updatedAt ? new Date(data.updatedAt).getTime() : 0;
          const created = data.createdAt ? new Date(data.createdAt).getTime() : 0;
          return Math.max(updated, created);
        })
        .catch(() => null),
    ]);

    // Get the maximum timestamp from all checks
    const maxTimestamp = Math.max(...checks.filter((t): t is number => t !== null), 0);
    const currentHash = maxTimestamp.toString();

    // If client provided a lastCheck timestamp, compare
    if (lastCheck) {
      const lastCheckTime = new Date(lastCheck).getTime();
      const hasUpdates = maxTimestamp > lastCheckTime;

      return NextResponse.json({
        hasUpdates,
        currentHash,
        timestamp: maxTimestamp > 0 ? new Date(maxTimestamp).toISOString() : null,
      });
    }

    // First check - just return the current hash
    return NextResponse.json({
      hasUpdates: false,
      currentHash,
      timestamp: maxTimestamp > 0 ? new Date(maxTimestamp).toISOString() : null,
    });
  } catch (error) {
    console.error("[Dashboard Check Updates] Error:", error);
    return NextResponse.json(
      { error: "Failed to check updates" },
      { status: 500 }
    );
  }
}

