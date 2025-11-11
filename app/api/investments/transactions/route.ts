import { NextRequest, NextResponse } from "next/server";
import { createInvestmentTransaction, createSecurity, createSecurityPrice } from "@/lib/api/investments";
import { InvestmentTransactionFormData } from "@/lib/validations/investment";
import { ZodError } from "zod";
import { guardFeatureAccess, getCurrentUserId } from "@/lib/api/feature-guard";
import { isPlanError } from "@/lib/utils/plan-errors";

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has access to investments
    const featureGuard = await guardFeatureAccess(userId, "hasInvestments");
    if (!featureGuard.allowed) {
      return NextResponse.json(
        { 
          error: featureGuard.error?.message || "Investments are not available in your current plan",
          code: featureGuard.error?.code,
          planError: featureGuard.error,
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    
    // Handle security creation if needed
    let securityId = body.securityId;
    if (!securityId && body.security) {
      // Create security if it doesn't exist
      const security = await createSecurity({
        symbol: body.security.symbol,
        name: body.security.name,
        class: body.security.class,
      });
      securityId = security.id;
    }

    // Prepare transaction data
    const transactionData: InvestmentTransactionFormData = {
      date: body.date instanceof Date ? body.date : new Date(body.date),
      accountId: body.accountId,
      securityId: securityId || undefined,
      type: body.type,
      quantity: body.quantity,
      price: body.price,
      fees: body.fees || 0,
      notes: body.notes,
    };

    const transaction = await createInvestmentTransaction(transactionData);

    // Handle price update if provided
    if (securityId && body.currentPrice) {
      try {
        await createSecurityPrice({
          securityId,
          date: transactionData.date,
          price: body.currentPrice,
        });
      } catch (error) {
        console.error("Error creating security price:", error);
        // Don't fail the transaction if price creation fails
      }
    }

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error("Error creating investment transaction:", error);
    
    if (isPlanError(error)) {
      return NextResponse.json(
        { 
          error: error.message,
          code: error.code,
          planError: error,
        },
        { status: 403 }
      );
    }
    
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') },
        { status: 400 }
      );
    }
    
    const errorMessage = error instanceof Error ? error.message : "Failed to create investment transaction";
    const statusCode = errorMessage.includes("Unauthorized") ? 401 : 400;
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

