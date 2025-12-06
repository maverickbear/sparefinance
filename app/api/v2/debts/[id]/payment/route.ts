import { NextRequest, NextResponse } from "next/server";
import { makeDebtsService } from "@/src/application/debts/debts.factory";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { revalidateTag } from 'next/cache';

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
    
    const service = makeDebtsService();
    const debt = await service.addPayment(id, amount);
    
    // Invalidate cache
    revalidateTag(`dashboard-${userId}`, 'max');
    revalidateTag(`reports-${userId}`, 'max');
    
    return NextResponse.json(debt, { status: 200 });
  } catch (error) {
    console.error("Error adding payment to debt:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add payment" },
      { status: 400 }
    );
  }
}

