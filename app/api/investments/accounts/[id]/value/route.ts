import { NextResponse } from "next/server";
import {
  getAccountInvestmentValue,
  upsertAccountInvestmentValue,
} from "@/lib/api/simple-investments";
import { z } from "zod";
import { guardFeatureAccess, getCurrentUserId } from "@/src/application/shared/feature-guard";
import { isPlanError } from "@/lib/utils/plan-errors";

const updateValueSchema = z.object({
  totalValue: z.number().positive(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const value = await getAccountInvestmentValue(id);
    return NextResponse.json(value);
  } catch (error) {
    console.error("Error fetching account investment value:", error);
    return NextResponse.json(
      { error: "Failed to fetch value" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await request.json();
    const validated = updateValueSchema.parse(body);
    const value = await upsertAccountInvestmentValue({
      accountId: id,
      totalValue: validated.totalValue,
    });
    return NextResponse.json(value);
  } catch (error) {
    console.error("Error updating account investment value:", error);
    
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
    
    const message =
      error instanceof Error ? error.message : "Failed to update value";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

