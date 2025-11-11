import { NextRequest, NextResponse } from "next/server";
import { getSecurities, createSecurity } from "@/lib/api/investments";
import { guardFeatureAccess, getCurrentUserId } from "@/lib/api/feature-guard";
import { isPlanError } from "@/lib/utils/plan-errors";
import { z } from "zod";

const createSecuritySchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
  name: z.string().min(1, "Name is required"),
  class: z.enum(["stock", "etf", "crypto", "bond", "reit"]),
});

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

    const securities = await getSecurities();
    return NextResponse.json(securities);
  } catch (error) {
    console.error("Error fetching securities:", error);
    return NextResponse.json(
      { error: "Failed to fetch securities" },
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

    const body = await request.json();
    const validated = createSecuritySchema.parse(body);
    
    const security = await createSecurity({
      symbol: validated.symbol,
      name: validated.name,
      class: validated.class,
    });

    return NextResponse.json(security, { status: 201 });
  } catch (error) {
    console.error("Error creating security:", error);
    
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
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') },
        { status: 400 }
      );
    }
    
    const message = error instanceof Error ? error.message : "Failed to create security";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

