import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { makeAccountsService } from "@/src/application/accounts/accounts.factory";
import { requireAccountOwnership } from "../../../../src/infrastructure/utils/security";

/**
 * GET /api/v2/accounts/[id]/has-transactions
 * Checks if an account has associated transactions
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    
    // Verify account ownership
    await requireAccountOwnership(id);
    
    const service = makeAccountsService();
    const hasTransactions = await service.hasTransactions(id);
    
    return NextResponse.json(
      { hasTransactions },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error checking account transactions:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to check transactions" },
      { status: 400 }
    );
  }
}

