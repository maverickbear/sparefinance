import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ExtractRequest {
  description: string;
  transactionType?: string;
}

interface ExtractedInfo {
  quantity?: number | null;
  price?: number | null;
  fees?: number | null;
  symbol?: string | null;
  securityName?: string | null;
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    const body: ExtractRequest = await request.json();
    const { description, transactionType } = body;

    if (!description || description.trim().length === 0) {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 }
      );
    }

    // Call OpenAI to extract information
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a financial data extraction assistant. Your role is to extract structured information from transaction descriptions/notes.

Extract the following information from the description:
- quantity: The number of shares/units (as a number, or null if not found)
- price: The price per share/unit (as a number, or null if not found)
- fees: Any fees, commissions, or charges mentioned (as a number, or null if not found)
- symbol: The stock/crypto symbol (e.g., "AAPL", "BTC", "ETH") if mentioned (as a string, or null if not found)
- securityName: The full name of the security if mentioned (as a string, or null if not found)

Transaction type: ${transactionType || "unknown"}

Important rules:
- Only extract information that is explicitly mentioned in the description
- For quantities, look for patterns like "10 shares", "0.5 BTC", "100 units", etc.
- For prices, look for patterns like "$50.25", "price: $100", "at $25.50", etc.
- For fees, look for words like "fee", "commission", "charge", "cost" followed by amounts
- For symbols, look for uppercase letter combinations (3-5 letters typically)
- Return null for any field that cannot be confidently extracted
- All monetary values should be numbers only (no currency symbols)
- All quantities should be numbers only

Return a JSON object in this exact format:
{
  "quantity": 10.5,
  "price": 50.25,
  "fees": 1.50,
  "symbol": "AAPL",
  "securityName": "Apple Inc."
}

Use null for any field that is not found.`,
        },
        {
          role: "user",
          content: `Extract information from this transaction description:\n\n"${description}"`,
        },
      ],
      temperature: 0.3, // Lower temperature for more consistent extraction
      max_tokens: 300,
      response_format: { type: "json_object" },
    });

    const responseContent = completion.choices[0]?.message?.content || "{}";
    let extractedInfo: ExtractedInfo = {};

    try {
      extractedInfo = JSON.parse(responseContent);
    } catch (parseError) {
      console.error("Error parsing OpenAI response:", parseError);
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 500 }
      );
    }

    // Validate and clean the extracted data
    const cleanedInfo: ExtractedInfo = {
      quantity:
        extractedInfo.quantity !== null && extractedInfo.quantity !== undefined
          ? Number(extractedInfo.quantity)
          : null,
      price:
        extractedInfo.price !== null && extractedInfo.price !== undefined
          ? Number(extractedInfo.price)
          : null,
      fees:
        extractedInfo.fees !== null && extractedInfo.fees !== undefined
          ? Number(extractedInfo.fees)
          : null,
      symbol:
        extractedInfo.symbol && typeof extractedInfo.symbol === "string"
          ? extractedInfo.symbol.trim().toUpperCase()
          : null,
      securityName:
        extractedInfo.securityName && typeof extractedInfo.securityName === "string"
          ? extractedInfo.securityName.trim()
          : null,
    };

    // Remove null values
    Object.keys(cleanedInfo).forEach((key) => {
      if (cleanedInfo[key as keyof ExtractedInfo] === null) {
        delete cleanedInfo[key as keyof ExtractedInfo];
      }
    });

    return NextResponse.json(cleanedInfo);
  } catch (error) {
    console.error("Error extracting transaction info:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to extract transaction information",
      },
      { status: 500 }
    );
  }
}

