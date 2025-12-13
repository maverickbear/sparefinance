import { NextRequest, NextResponse } from "next/server";
import { makeGoalsService } from "@/src/application/goals/goals.factory";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { topUpAmountSchema } from "@/src/domain/goals/goals.validations";
import { revalidateTag } from 'next/cache';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { amount } = body;

    // Validate amount using domain schema
    const validationResult = topUpAmountSchema.safeParse(amount);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.errors[0]?.message || "Amount must be a positive number" },
        { status: 400 }
      );
    }

    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const service = makeGoalsService();
    const goal = await service.addTopUp(id, validationResult.data);
    
    // Invalidate cache
    revalidateTag(`dashboard-${userId}`, 'max');
    revalidateTag(`reports-${userId}`, 'max');
    
    return NextResponse.json(goal, { status: 200 });
  } catch (error) {
    console.error("Error adding top-up to goal:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add top-up" },
      { status: 400 }
    );
  }
}

