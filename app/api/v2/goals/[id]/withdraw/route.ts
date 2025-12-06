import { NextRequest, NextResponse } from "next/server";
import { makeGoalsService } from "@/src/application/goals/goals.factory";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { revalidateTag } from 'next/cache';

/**
 * POST /api/v2/goals/[id]/withdraw
 * Withdraws money from a goal
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { amount } = body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number" },
        { status: 400 }
      );
    }

    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const service = makeGoalsService();
    const goal = await service.withdraw(id, amount);
    
    // Invalidate cache
    revalidateTag(`dashboard-${userId}`, 'max');
    revalidateTag(`reports-${userId}`, 'max');
    
    return NextResponse.json(goal, { status: 200 });
  } catch (error) {
    console.error("Error withdrawing from goal:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to withdraw from goal" },
      { status: 400 }
    );
  }
}

