import { NextRequest, NextResponse } from "next/server";
import { makeDebtsService } from "@/src/application/debts/debts.factory";
import { DebtFormData, debtSchema } from "@/src/domain/debts/debts.validations";
import { ZodError } from "zod";

export async function GET(request: NextRequest) {
  try {
    const service = makeDebtsService();
    const debts = await service.getDebts();
    
    return NextResponse.json(debts, { status: 200 });
  } catch (error) {
    console.error("Error fetching debts:", error);
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
    
    const service = makeDebtsService();
    const debt = await service.createDebt(validatedData);
    
    return NextResponse.json(debt, { status: 201 });
  } catch (error) {
    console.error("Error creating debt:", error);
    
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') },
        { status: 400 }
      );
    }
    
    const errorMessage = error instanceof Error ? error.message : "Failed to create debt";
    const statusCode = errorMessage.includes("Unauthorized") ? 401 : 400;
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

