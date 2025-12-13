import { NextResponse } from "next/server";
import { makeInvestmentsService } from "@/src/application/investments/investments.factory";
import { z } from "zod";
import { guardFeatureAccess, getCurrentUserId } from "@/src/application/shared/feature-guard";
import { AppError } from "@/src/application/shared/app-error";
import { createSimpleInvestmentEntrySchema } from "@/src/domain/investments/investments.validations";


export async function GET(request: Request) {
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

    const service = makeInvestmentsService();
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId") || undefined;

    const entries = await service.getSimpleInvestmentEntries(accountId);
    return NextResponse.json(entries, {
    });
  } catch (error) {
    console.error("Error fetching simple investment entries:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch entries" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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

    const service = makeInvestmentsService();
    const body = await request.json();
    const validated = createSimpleInvestmentEntrySchema.parse(body);
    const entry = await service.createSimpleInvestmentEntry({
      ...validated,
      date: validated.date instanceof Date ? validated.date : new Date(validated.date),
    });
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error("Error creating simple investment entry:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create entry" },
      { status: 500 }
    );
  }
}

