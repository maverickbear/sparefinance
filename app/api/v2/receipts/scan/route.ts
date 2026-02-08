import { NextRequest, NextResponse } from "next/server";
import { makeReceiptsService } from "@/src/application/receipts/receipts.factory";
import { getCurrentUserId, guardFeatureAccess } from "@/src/application/shared/feature-guard";

/**
 * POST /api/v2/receipts/scan
 * Upload receipt and optionally extract data using AI
 * 
 * SIMPLIFIED: Now uses feature flag for AI extraction.
 * Upload always works, AI extraction is optional.
 * Alternative: use /api/v2/receipts/upload + /api/v2/receipts/[id]/extract separately.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has access to receipt scanner feature
    const featureGuard = await guardFeatureAccess(userId, "hasReceiptScanner");
    if (!featureGuard.allowed) {
      return NextResponse.json(
        { 
          error: featureGuard.error?.message || "Receipt scanner is not available in your current plan",
          code: featureGuard.error?.code,
          planError: featureGuard.error,
        },
        { status: 403 }
      );
    }

    // SIMPLIFIED: AI extraction is now optional (feature flag)
    // Upload will work even if AI is disabled

    // Get file from FormData
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Scan receipt (includes saving to storage)
    const service = makeReceiptsService();
    const result = await service.scanReceipt(userId, file, buffer);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to scan receipt" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("Error scanning receipt:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to scan receipt",
      },
      { status: 500 }
    );
  }
}

