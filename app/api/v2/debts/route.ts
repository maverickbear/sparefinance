import { NextRequest, NextResponse } from "next/server";
import { makeDebtsService } from "@/src/application/debts/debts.factory";
import { DebtFormData, debtSchema } from "@/src/domain/debts/debts.validations";
import { AppError } from "@/src/application/shared/app-error";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { ZodError } from "zod";
import { getCacheHeaders } from "@/src/infrastructure/utils/cache-headers";
import { revalidateTag } from 'next/cache';

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const service = makeDebtsService();
    const debts = await service.getDebts();
    
    // Debts change occasionally, use semi-static cache
    const cacheHeaders = getCacheHeaders('semi-static');
    
    return NextResponse.json(debts, { 
      status: 200,
      headers: cacheHeaders,
    });
  } catch (error) {
    console.error("Error fetching debts:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch debts" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Convert dates if they are strings
    const data: DebtFormData = {
      ...body,
      firstPaymentDate: body.firstPaymentDate instanceof Date 
        ? body.firstPaymentDate 
        : new Date(body.firstPaymentDate),
      startDate: body.startDate 
        ? (body.startDate instanceof Date ? body.startDate : new Date(body.startDate))
        : undefined,
    };
    
    // Validate with schema
    const validatedData = debtSchema.parse(data);
    
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const service = makeDebtsService();
    const debt = await service.createDebt(validatedData);
    
    // Invalidate cache
    revalidateTag(`dashboard-${userId}`, 'max');
    revalidateTag(`reports-${userId}`, 'max');
    
    return NextResponse.json(debt, { status: 201 });
  } catch (error) {
    console.error("Error creating debt:", error);
    
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
      { error: error instanceof Error ? error.message : "Failed to create debt" },
      { status: 500 }
    );
  }
}

