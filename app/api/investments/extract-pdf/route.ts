import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, guardFeatureAccess } from "@/src/application/shared/feature-guard";
import { extractTransactionsFromPDF } from "@/lib/pdf/investment-extract";
import { InvestmentTransactionInput } from "@/lib/csv/investment-import";

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

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
          error:
            featureGuard.error?.message ||
            "Investments are not available in your current plan",
          code: featureGuard.error?.code,
          planError: featureGuard.error,
        },
        { status: 403 }
      );
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured. PDF extraction requires AI." },
        { status: 500 }
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

    // Validate file type
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "File must be a PDF" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract transactions from PDF
    const result = await extractTransactionsFromPDF(buffer, file.name);

    // Validate that we got some result
    if (!result) {
      return NextResponse.json(
        { error: "Failed to extract transactions from PDF" },
        { status: 500 }
      );
    }

    // Map transactions to include accountId placeholder (will be set by frontend)
    // Also preserve the account name from extraction if available
    const transactions: (InvestmentTransactionInput & { account?: string })[] = result.transactions.map(
      (tx) => {
        // Try to extract account from the transaction if it was in the original data
        const accountName = (tx as any).account;
        return {
          ...tx,
          // accountId will be set by the frontend based on account mapping
          // For now, we'll leave it empty and let the frontend handle it
          accountId: "",
          // Preserve account name for frontend mapping
          account: accountName,
        };
      }
    );

    return NextResponse.json({
      success: true,
      transactions,
      rawText: result.rawText,
      errors: result.errors,
      fileName: file.name,
    });
  } catch (error) {
    console.error("Error extracting transactions from PDF:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to extract transactions from PDF",
      },
      { status: 500 }
    );
  }
}

