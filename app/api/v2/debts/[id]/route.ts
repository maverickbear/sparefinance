import { NextRequest, NextResponse } from "next/server";
import { makeDebtsService } from "@/src/application/debts/debts.factory";
import { DebtFormData } from "@/src/domain/debts/debts.validations";
import { ZodError } from "zod";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const service = makeDebtsService();
    const debt = await service.getDebtById(id);
    
    if (!debt) {
      return NextResponse.json(
        { error: "Debt not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(debt, { status: 200 });
  } catch (error) {
    console.error("Error fetching debt:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch debt" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // Convert dates if they are strings
    const data: Partial<DebtFormData> = {
      ...body,
      firstPaymentDate: body.firstPaymentDate 
        ? (body.firstPaymentDate instanceof Date ? body.firstPaymentDate : new Date(body.firstPaymentDate))
        : undefined,
      startDate: body.startDate 
        ? (body.startDate instanceof Date ? body.startDate : new Date(body.startDate))
        : undefined,
    };
    
    const service = makeDebtsService();
    const debt = await service.updateDebt(id, data);
    
    return NextResponse.json(debt, { status: 200 });
  } catch (error) {
    console.error("Error updating debt:", error);
    
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') },
        { status: 400 }
      );
    }
    
    const errorMessage = error instanceof Error ? error.message : "Failed to update debt";
    const statusCode = errorMessage.includes("Unauthorized") ? 401 : 400;
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const service = makeDebtsService();
    await service.deleteDebt(id);
    
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting debt:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete debt" },
      { status: 400 }
    );
  }
}

