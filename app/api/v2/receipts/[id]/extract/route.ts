import { NextRequest, NextResponse } from "next/server";
import { makeReceiptsService } from "@/src/application/receipts/receipts.factory";
import { getCurrentUserId, guardFeatureAccess } from "@/src/application/shared/feature-guard";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";

/**
 * POST /api/v2/receipts/[id]/extract
 * Extract receipt data using AI (EXPERIMENTAL - optional, feature flag)
 * SIMPLIFIED: AI extraction is now optional and separated from upload
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Check if AI extraction is enabled
    if (process.env.ENABLE_RECEIPTS_AI !== 'true') {
      return NextResponse.json(
        { 
          error: "AI extraction is not enabled. This is an experimental feature.",
          experimental: true,
        },
        { status: 403 }
      );
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured. Receipt extraction requires AI." },
        { status: 500 }
      );
    }

    const { id: receiptPath } = await params;

    // Get file from request
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided. File is required for AI extraction." },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract receipt data using AI (experimental)
    const service = makeReceiptsService();
    const receiptData = await service.extractReceiptData(receiptPath, file, buffer);

    return NextResponse.json({
      success: true,
      data: receiptData,
      message: "Receipt data extracted successfully",
    });
  } catch (error) {
    console.error("Error extracting receipt data:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to extract receipt data",
      },
      { status: 500 }
    );
  }
}
