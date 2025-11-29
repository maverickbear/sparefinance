import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, guardFeatureAccess } from "@/src/application/shared/feature-guard";
import OpenAI from "openai";
import { validateImageFile } from "@/lib/utils/file-validation";

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

interface ReceiptData {
  amount?: number;
  merchant?: string;
  date?: string;
  description?: string;
  items?: Array<{ name: string; price: number }>;
}

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

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured. Receipt scanning requires AI." },
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

    // Validate file type (images only)
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "File must be an image" },
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

    // Convert File to Buffer for validation
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate image file
    const validation = await validateImageFile(file, buffer);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || "Invalid image file" },
        { status: 400 }
      );
    }

    // Convert to base64 for OpenAI Vision API
    const base64Image = buffer.toString("base64");
    const mimeType = file.type || "image/jpeg";

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Use GPT-4 Vision to extract receipt data
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a receipt scanning expert. Extract transaction data from the receipt image. 
Return a JSON object with the following structure:
{
  "amount": number (total amount, required),
  "merchant": string (store/merchant name, optional),
  "date": string (YYYY-MM-DD format, optional),
  "description": string (optional description or first item name),
  "items": array of {name: string, price: number} (optional, if itemized)
}

Rules:
- Extract the total amount (usually at the bottom, labeled "Total", "Amount", etc.)
- Extract merchant/store name from header or top of receipt
- Extract date if visible (convert to YYYY-MM-DD format)
- If date is not visible, use today's date
- Extract description from merchant name or first item
- If items are listed, include them in the items array
- Amount should be a positive number
- Return only valid JSON, no additional text`,
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
            {
              type: "text",
              text: "Extract all transaction data from this receipt. Return only valid JSON.",
            },
          ],
        },
      ],
      max_tokens: 1000,
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "Failed to extract data from receipt" },
        { status: 500 }
      );
    }

    // Parse JSON response
    let receiptData: ReceiptData;
    try {
      // Try to extract JSON from the response (in case there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : content;
      receiptData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error("Error parsing receipt data:", parseError);
      return NextResponse.json(
        { error: "Failed to parse receipt data. Please try again." },
        { status: 500 }
      );
    }

    // Validate and normalize the data
    const result: ReceiptData = {
      amount: receiptData.amount && receiptData.amount > 0 ? receiptData.amount : undefined,
      merchant: receiptData.merchant?.trim() || undefined,
      date: receiptData.date || undefined,
      description: receiptData.description?.trim() || receiptData.merchant?.trim() || undefined,
      items: receiptData.items || undefined,
    };

    return NextResponse.json({
      success: true,
      data: result,
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

