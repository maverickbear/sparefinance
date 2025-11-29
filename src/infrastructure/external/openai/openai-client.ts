/**
 * OpenAI Client
 * External service integration for OpenAI API
 */

import OpenAI from "openai";
import { logger } from "@/src/infrastructure/utils/logger";

export class OpenAIClient {
  private client: OpenAI;

  constructor(apiKey?: string) {
    if (!apiKey && !process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key is required");
    }
    
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY!,
    });
  }

  /**
   * Extract receipt data from image using GPT-4 Vision
   */
  async extractReceiptData(base64Image: string, mimeType: string): Promise<{
    amount?: number;
    merchant?: string;
    date?: string;
    description?: string;
    items?: Array<{ name: string; price: number }>;
  }> {
    try {
      const response = await this.client.chat.completions.create({
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
        throw new Error("Failed to extract data from receipt");
      }

      // Try to extract JSON from the response (in case there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : content;
      const receiptData = JSON.parse(jsonString);

      return {
        amount: receiptData.amount && receiptData.amount > 0 ? receiptData.amount : undefined,
        merchant: receiptData.merchant?.trim() || undefined,
        date: receiptData.date || undefined,
        description: receiptData.description?.trim() || receiptData.merchant?.trim() || undefined,
        items: receiptData.items || undefined,
      };
    } catch (error) {
      logger.error("[OpenAIClient] Error extracting receipt data:", error);
      throw error;
    }
  }
}

