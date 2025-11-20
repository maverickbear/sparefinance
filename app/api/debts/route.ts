import { NextRequest, NextResponse } from "next/server";
import { createDebt, getDebts } from "@/lib/api/debts";
import { debtSchema, DebtFormData } from "@/lib/validations/debt";
import { ZodError } from "zod";
import { getCurrentUserId, guardWriteAccess, throwIfNotAllowed } from "@/lib/api/feature-guard";

export async function GET(request: NextRequest) {
  try {
    const debts = await getDebts();
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
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user can perform write operations
    const writeGuard = await guardWriteAccess(userId);
    await throwIfNotAllowed(writeGuard);

    const data: DebtFormData = await request.json();
    
    // Validate the data
    const validatedData = debtSchema.parse(data);
    
    const debt = await createDebt({
      name: validatedData.name,
      loanType: validatedData.loanType,
      initialAmount: validatedData.initialAmount,
      downPayment: validatedData.downPayment,
      interestRate: validatedData.interestRate ?? 0,
      totalMonths: validatedData.totalMonths ?? 0,
      firstPaymentDate: validatedData.firstPaymentDate!,
      startDate: validatedData.startDate,
      monthlyPayment: validatedData.monthlyPayment ?? 0,
      paymentFrequency: validatedData.paymentFrequency,
      paymentAmount: validatedData.paymentAmount,
      additionalContributions: validatedData.additionalContributions,
      additionalContributionAmount: validatedData.additionalContributionAmount,
      priority: validatedData.priority,
      description: validatedData.description,
      accountId: validatedData.accountId,
      isPaused: validatedData.isPaused,
    });
    
    return NextResponse.json(debt, { status: 201 });
  } catch (error) {
    console.error("Error creating debt:", error);
    
    // Handle validation errors
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') },
        { status: 400 }
      );
    }
    
    // Handle other errors
    const errorMessage = error instanceof Error ? error.message : "Failed to create debt";
    const statusCode = errorMessage.includes("Unauthorized") ? 401 : 400;
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}




