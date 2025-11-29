import { NextRequest, NextResponse } from "next/server";
import { 
  createInvestmentTransaction, 
  updateInvestmentTransaction,
  deleteInvestmentTransaction,
  getInvestmentTransactions,
  createSecurity, 
  createSecurityPrice 
} from "@/lib/api/investments";
import { InvestmentTransactionFormData } from "@/src/domain/investments/investments.validations";
import { ZodError } from "zod";
import { guardFeatureAccess, getCurrentUserId } from "@/src/application/shared/feature-guard";
import { isPlanError } from "@/lib/utils/plan-errors";
import { invalidatePortfolioCache } from "@/lib/api/portfolio";

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId") || undefined;
    const securityId = searchParams.get("securityId") || undefined;
    const startDate = searchParams.get("startDate") ? new Date(searchParams.get("startDate")!) : undefined;
    const endDate = searchParams.get("endDate") ? new Date(searchParams.get("endDate")!) : undefined;

    const transactions = await getInvestmentTransactions({
      accountId,
      securityId,
      startDate,
      endDate,
    });

    return NextResponse.json(transactions);
  } catch (error) {
    console.error("Error fetching investment transactions:", error);
    
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
    
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch investment transactions";
    return NextResponse.json(
      { error: errorMessage },
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

    // Invalidate portfolio cache to ensure fresh data
    try {
      await invalidatePortfolioCache();
    } catch (error) {
      console.error("Error invalidating portfolio cache:", error);
      // Don't fail the transaction if cache invalidation fails
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

