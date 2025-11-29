import { NextRequest, NextResponse } from "next/server";
import { makeBudgetsService } from "@/src/application/budgets/budgets.factory";
import { BudgetFormData } from "@/src/domain/budgets/budgets.validations";
import { ZodError } from "zod";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const periodParam = searchParams.get("period");
    
    if (!periodParam) {
      return NextResponse.json(
        { error: "period parameter is required" },
        { status: 400 }
      );
    }

    const period = new Date(periodParam);
    if (isNaN(period.getTime())) {
      return NextResponse.json(
        { error: "Invalid period format" },
        { status: 400 }
      );
    }

    const service = makeBudgetsService();
    const budgets = await service.getBudgets(period);
    
    return NextResponse.json(budgets, {
      status: 200,
      headers: {
        'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    console.error("Error fetching budgets:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch budgets" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    
    // Convert period to Date
    const data: BudgetFormData = {
      ...body,
      period: body.period instanceof Date ? body.period : new Date(body.period),
    };
    
    const service = makeBudgetsService();
    const budget = await service.createBudget(data);
    
    return NextResponse.json(budget, { status: 201 });
  } catch (error) {
    console.error("Error creating budget:", error);
    
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') },
        { status: 400 }
      );
    }
    
    const errorMessage = error instanceof Error ? error.message : "Failed to create budget";
    const statusCode = errorMessage.includes("Unauthorized") ? 401 : 400;
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

