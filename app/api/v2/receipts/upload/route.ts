import { NextRequest, NextResponse } from "next/server";
import { makeReceiptsService } from "@/src/application/receipts/receipts.factory";
import { getCurrentUserId, guardFeatureAccess } from "@/src/application/shared/feature-guard";

/**
 * POST /api/v2/receipts/upload
 * Upload receipt file to storage (CORE - always works)
 * SIMPLIFIED: Core functionality separated from AI extraction
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has access to receipt feature
    const featureGuard = await guardFeatureAccess(userId, "hasReceiptScanner");
    if (!featureGuard.allowed) {
      return NextResponse.json(
        { 
          error: featureGuard.error?.message || "Receipt upload is not available in your current plan",
          code: featureGuard.error?.code,
          planError: featureGuard.error,
        },
        { status: 403 }
      );
    }

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

    // Upload receipt (core - always works, no AI required)
    const service = makeReceiptsService();
    const { receiptUrl, receiptPath } = await service.uploadReceipt(userId, file, buffer);

    return NextResponse.json({
      success: true,
      receiptUrl,
      receiptPath,
      message: "Receipt uploaded successfully",
    });
  } catch (error) {
    console.error("Error uploading receipt:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to upload receipt",
      },
      { status: 500 }
    );
  }
}
