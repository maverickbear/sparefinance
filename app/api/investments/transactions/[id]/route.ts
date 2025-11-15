import { NextRequest, NextResponse } from "next/server";
import { 
  updateInvestmentTransaction,
  deleteInvestmentTransaction,
  createSecurity,
  createSecurityPrice
} from "@/lib/api/investments";
import { InvestmentTransactionFormData } from "@/lib/validations/investment";
import { ZodError } from "zod";
import { guardFeatureAccess, getCurrentUserId } from "@/lib/api/feature-guard";
import { isPlanError } from "@/lib/utils/plan-errors";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const transactionId = params.id;
    
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
    const transactionData: Partial<InvestmentTransactionFormData> = {};
    if (body.date !== undefined) {
      transactionData.date = body.date instanceof Date ? body.date : new Date(body.date);
    }
    if (body.accountId !== undefined) transactionData.accountId = body.accountId;
    if (securityId !== undefined) transactionData.securityId = securityId || undefined;
    if (body.type !== undefined) transactionData.type = body.type;
    if (body.quantity !== undefined) transactionData.quantity = body.quantity;
    if (body.price !== undefined) transactionData.price = body.price;
    if (body.fees !== undefined) transactionData.fees = body.fees || 0;
    if (body.notes !== undefined) transactionData.notes = body.notes;

    const transaction = await updateInvestmentTransaction(transactionId, transactionData);

    // Handle price update if provided
    if (securityId && body.currentPrice && transactionData.date) {
      try {
        await createSecurityPrice({
          securityId,
          date: transactionData.date instanceof Date ? transactionData.date : new Date(transactionData.date),
          price: body.currentPrice,
        });
      } catch (error) {
        console.error("Error creating security price:", error);
        // Don't fail the transaction if price creation fails
      }
    }

    return NextResponse.json(transaction);
  } catch (error) {
    console.error("Error updating investment transaction:", error);
    
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
    
    const errorMessage = error instanceof Error ? error.message : "Failed to update investment transaction";
    const statusCode = errorMessage.includes("Unauthorized") ? 401 : 400;
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const transactionId = params.id;
    await deleteInvestmentTransaction(transactionId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting investment transaction:", error);
    
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
    
    const errorMessage = error instanceof Error ? error.message : "Failed to delete investment transaction";
    const statusCode = errorMessage.includes("Unauthorized") ? 401 : 400;
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

