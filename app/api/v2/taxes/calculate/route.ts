import { NextRequest, NextResponse } from "next/server";
import { makeTaxesService } from "@/src/application/taxes/taxes.factory";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { taxCalculationInputSchema } from "@/src/domain/taxes/taxes.validations";
import { AppError } from "@/src/application/shared/app-error";

/**
 * POST /api/v2/taxes/calculate
 * Calculate taxes based on location and income
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = taxCalculationInputSchema.parse(body);

    const taxesService = makeTaxesService();
    const result = await taxesService.calculateTaxes(validated);

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("[TAXES-CALCULATE] Error calculating taxes:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: error instanceof AppError ? error.statusCode : 500 }
    );
  }
}

