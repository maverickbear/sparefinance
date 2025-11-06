import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getBudgets, createBudget } from "@/lib/api/budgets";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period");
    const date = period ? new Date(period) : new Date();
    const budgets = await getBudgets(date);
    return NextResponse.json(budgets, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch budgets" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const budget = await createBudget({
      ...data,
      period: new Date(data.period),
    });
    revalidateTag('budgets', 'max');
    revalidateTag('financial-health', 'max');
    return NextResponse.json(budget);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to create budget";
    console.error("API error creating budget:", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

