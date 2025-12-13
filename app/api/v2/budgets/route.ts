import { NextRequest, NextResponse } from "next/server";
import { makeBudgetsService } from "@/src/application/budgets/budgets.factory";
import { BudgetFormData } from "@/src/domain/budgets/budgets.validations";
import { AppError } from "@/src/application/shared/app-error";
import { ZodError } from "zod";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { getCacheHeaders } from "@/src/infrastructure/utils/cache-headers";
import { revalidateTag } from 'next/cache';


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
    
    // Budgets change occasionally, use semi-static cache
    const cacheHeaders = getCacheHeaders('semi-static');
    
    return NextResponse.json(budgets, {
      status: 200,
      headers: cacheHeaders,
    });
  } catch (error) {
    console.error("Error fetching budgets:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
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
    
    // Invalidate cache
    revalidateTag(`dashboard-${userId}`, 'max');
    revalidateTag(`reports-${userId}`, 'max');
    
    return NextResponse.json(budget, { status: 201 });
  } catch (error) {
    console.error("Error creating budget:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create budget" },
      { status: 500 }
    );
  }
}

