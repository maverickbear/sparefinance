/**
 * GET /api/v2/investments/manual
 * POST /api/v2/investments/manual
 * Get and create manual investments
 */

import { NextRequest, NextResponse } from "next/server";
import { makeInvestmentsRefreshService } from "@/src/application/investments/investments.factory";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { guardFeatureAccess } from "@/src/application/shared/feature-guard";
import { AppError } from "@/src/application/shared/app-error";
import { manualInvestmentSchema } from "@/src/domain/investments/investments.validations";
import { InvestmentsRepository } from "@/src/infrastructure/database/repositories/investments.repository";
import { logger } from "@/src/infrastructure/utils/logger";
import { formatTimestamp } from "@/src/infrastructure/utils/timestamp";
import crypto from "crypto";
import { z } from "zod";

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

    const repository = new InvestmentsRepository();
    const manualInvestments = await repository.findManualInvestments(userId);

    return NextResponse.json(manualInvestments, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    logger.error("[Manual Investments API] Error:", error);

    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch manual investments" },
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
    const validated = manualInvestmentSchema.parse(body);

    const repository = new InvestmentsRepository();
    const investment = await repository.createManualInvestment(userId, {
      id: crypto.randomUUID(),
      title: validated.title,
      currentValue: validated.currentValue,
      estimatedGrowth: validated.estimatedGrowth || null,
    });

    return NextResponse.json(investment, { status: 201 });
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
      { error: error instanceof Error ? error.message : "Failed to create manual investment" },
      { status: 500 }
    );
  }
}
