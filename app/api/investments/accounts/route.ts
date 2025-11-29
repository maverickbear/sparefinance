import { NextRequest, NextResponse } from "next/server";
import { getInvestmentAccounts, createInvestmentAccount } from "@/lib/api/investments";
import { guardFeatureAccess, getCurrentUserId } from "@/src/application/shared/feature-guard";
import { isPlanError } from "@/lib/utils/plan-errors";
import { investmentAccountSchema } from "@/src/domain/investments/investments.validations";

export async function GET(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has access to investments
    const featureGuard = await guardFeatureAccess(userId, "hasInvestments");
    if (!featureGuard.allowed) {
      return NextResponse.json(
        { 
          error: featureGuard.error?.message || "Investments are not available in your current plan",
          code: featureGuard.error?.code,
          planError: featureGuard.error,
        },
        { status: 403 }
      );
    }

    const accounts = await getInvestmentAccounts();
    return NextResponse.json(accounts);
  } catch (error) {
    console.error("Error fetching investment accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch investment accounts" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has access to investments
    const featureGuard = await guardFeatureAccess(userId, "hasInvestments");
    if (!featureGuard.allowed) {
      return NextResponse.json(
        { 
          error: featureGuard.error?.message || "Investments are not available in your current plan",
          code: featureGuard.error?.code,
          planError: featureGuard.error,
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validated = investmentAccountSchema.parse(body);
    
    const account = await createInvestmentAccount(validated);
    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    console.error("Error creating investment account:", error);
    
    if (isPlanError(error)) {
      return NextResponse.json(
        { 
          error: error.message,
          code: error.code,
          planError: error,
        },
        { status: 403 }
      );
    }
    
    const message = error instanceof Error ? error.message : "Failed to create investment account";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

