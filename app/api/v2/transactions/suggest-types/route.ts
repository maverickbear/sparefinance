import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import OpenAI from "openai";

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

    const body = await request.json();
    const { values }: { values: string[] } = body;

    if (!values || !Array.isArray(values) || values.length === 0) {
      return NextResponse.json(
        { error: "Values array is required" },
        { status: 400 }
      );
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Create prompt for AI
    const prompt = `You are a financial transaction classifier. Classify each CSV transaction type value into one of three categories: "expense", "income", or "transfer".

Transaction types:
- expense: money going out (purchases, payments, withdrawals, debits, charges)
- income: money coming in (deposits, credits, salary, interest, dividends, refunds)
- transfer: money moving between accounts (transfers, moves, internal transactions)

CSV values to classify:
${values.map((v, i) => `${i + 1}. "${v}"`).join("\n")}

Return a JSON object mapping each value to its classification. Example:
{
  "SPEND": "expense",
  "DEPOSIT": "income",
  "E_TRFOUT": "transfer"
}

Return only valid JSON, no additional text.`;

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a financial transaction classifier. Return only valid JSON objects.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.1, // Low temperature for consistent results
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "No response from AI" },
        { status: 500 }
      );
    }

    // Parse response
    let suggestions: Record<string, "expense" | "income" | "transfer"> = {};
    try {
      const parsed = JSON.parse(content);
      suggestions = parsed;
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 500 }
      );
    }

    // Validate suggestions
    const validTypes = ["expense", "income", "transfer"];
    const validated: Record<string, "expense" | "income" | "transfer"> = {};

    for (const [key, value] of Object.entries(suggestions)) {
      if (validTypes.includes(value as string)) {
        validated[key] = value as "expense" | "income" | "transfer";
      }
    }

    return NextResponse.json({ suggestions: validated });
  } catch (error) {
    console.error("Error suggesting transaction types:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to suggest types",
      },
      { status: 500 }
    );
  }
}
