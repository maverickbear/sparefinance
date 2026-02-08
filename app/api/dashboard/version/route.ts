import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { makeDashboardService } from "@/src/application/dashboard/dashboard.factory";
import { AppError } from "@/src/application/shared/app-error";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";

/**
 * GET /api/dashboard/version
 * Returns a single version identifier for the current user's dashboard.
 * Version = max(updated_at) across transactions, accounts, budgets, goals, debts,
 * planned_payments, user_subscriptions, and users. Used by the client to decide
 * whether to refetch the full dashboard (snapshot → version check → conditional refetch).
 */
export async function GET() {
  noStore();

  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const service = makeDashboardService();
    const version = await service.getDashboardVersion(userId);

    return NextResponse.json({ version });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: "Failed to get dashboard version" },
      { status: 500 }
    );
  }
}
