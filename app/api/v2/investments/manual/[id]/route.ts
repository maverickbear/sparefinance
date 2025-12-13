/**
 * PUT /api/v2/investments/manual/[id]
 * DELETE /api/v2/investments/manual/[id]
 * Update and delete manual investments
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { guardFeatureAccess } from "@/src/application/shared/feature-guard";
import { AppError } from "@/src/application/shared/app-error";
import { updateManualInvestmentSchema } from "@/src/domain/investments/investments.validations";
import { InvestmentsRepository } from "@/src/infrastructure/database/repositories/investments.repository";
import { logger } from "@/src/infrastructure/utils/logger";
import { z } from "zod";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;
    const body = await request.json();
    const validated = updateManualInvestmentSchema.parse(body);

    const repository = new InvestmentsRepository();
    await repository.updateManualInvestment(id, {
      title: validated.title,
      currentValue: validated.currentValue,
      estimatedGrowth: validated.estimatedGrowth,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("[Manual Investments API] Error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') },
        { status: 400 }
      );
    }

    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update manual investment" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;
    const repository = new InvestmentsRepository();
    await repository.deleteManualInvestment(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("[Manual Investments API] Error:", error);

    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete manual investment" },
      { status: 500 }
    );
  }
}
