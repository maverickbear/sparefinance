import pdfParse from "pdf-parse";
import OpenAI from "openai";
import { InvestmentTransactionInput } from "@/lib/csv/investment-import";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface PDFExtractionResult {
  transactions: InvestmentTransactionInput[];
  rawText?: string;
  errors?: string[];
}

export interface ExtractedTransaction {
  date: string; // ISO date string or date string in common format
  type: "buy" | "sell" | "dividend" | "interest" | "transfer_in" | "transfer_out";
  symbol?: string;
  securityName?: string;
  quantity?: number;
  price?: number;
  fees?: number;
  amount?: number; // For dividends, interest, transfers
  account?: string; // Account name if mentioned
  notes?: string;
}

/**
 * Extract text from PDF buffer
 */
export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(pdfBuffer);
    return data.text;
  } catch (error) {
    throw new Error(
      `Failed to extract text from PDF: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Extract investment transactions from PDF text using OpenAI
 */
export async function extractTransactionsFromText(
  text: string,
  fileName?: string
): Promise<ExtractedTransaction[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured");
  }

  const prompt = `You are a financial data extraction assistant. Extract investment transactions from the following bank statement or investment report text.

Extract ALL investment transactions you can find in the text. For each transaction, extract:
- date: The transaction date (in ISO format YYYY-MM-DD or any common date format)
- type: One of: "buy", "sell", "dividend", "interest", "transfer_in", "transfer_out"
  * "buy" = purchase of securities
  * "sell" = sale of securities
  * "dividend" = dividend payment received
  * "interest" = interest payment received
  * "transfer_in" = deposit/contribution to account
  * "transfer_out" = withdrawal from account
- symbol: Stock/crypto symbol (e.g., "AAPL", "BTC", "ETH", "XDV") if mentioned
- securityName: Full name of the security if mentioned
- quantity: Number of shares/units (for buy/sell transactions)
- price: Price per share/unit (for buy/sell transactions)
- fees: Any fees, commissions, or charges (as a number)
- amount: Total amount (for dividends, interest, transfers, or total cost/proceeds for buy/sell)
- account: Account name or type if mentioned (e.g., "RRSP", "TFSA", "Taxable")
- notes: Description or notes about the transaction

Important rules:
- Extract ALL transactions found in the text
- For buy/sell: quantity and price are required
- For dividend/interest: amount is required, symbol is optional but preferred
- For transfers: amount is optional
- Dates should be parsed from the text (look for date patterns like "2024-01-15", "Jan 15, 2024", "15/01/2024", etc.)
- All monetary values should be numbers only (no currency symbols)
- All quantities should be numbers only
- If a field is not found, omit it (don't use null)
- Be thorough - extract every transaction you can identify

Return a JSON array of transactions in this exact format:
[
  {
    "date": "2024-01-15",
    "type": "buy",
    "symbol": "AAPL",
    "securityName": "Apple Inc.",
    "quantity": 10,
    "price": 150.25,
    "fees": 1.50,
    "amount": 1503.00,
    "account": "RRSP",
    "notes": "Purchase of Apple shares"
  },
  {
    "date": "2024-01-20",
    "type": "dividend",
    "symbol": "AAPL",
    "amount": 25.00,
    "notes": "Quarterly dividend payment"
  }
]

If no transactions are found, return an empty array [].

Text to extract from:
${text.substring(0, 15000)}${text.length > 15000 ? "\n\n[... text truncated ...]" : ""}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a financial data extraction assistant. Extract investment transactions from bank statements and investment reports. Return only valid JSON objects with a 'transactions' array property.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2, // Low temperature for consistent extraction
      max_tokens: 4000,
      response_format: { type: "json_object" },
    });

    const responseContent = completion.choices[0]?.message?.content || "{}";
    let parsedResponse: { transactions?: ExtractedTransaction[] } = {};

    try {
      parsedResponse = JSON.parse(responseContent);
    } catch (parseError) {
      // Try to extract JSON array directly if wrapped in object
      const arrayMatch = responseContent.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        parsedResponse = { transactions: JSON.parse(arrayMatch[0]) };
      } else {
        throw new Error("Failed to parse AI response as JSON");
      }
    }

    const transactions = parsedResponse.transactions || [];
    
    // Validate and normalize transactions
    return transactions.map((tx) => ({
      ...tx,
      symbol: tx.symbol?.trim().toUpperCase(),
      securityName: tx.securityName?.trim(),
      account: tx.account?.trim(),
      notes: tx.notes?.trim(),
    }));
  } catch (error) {
    console.error("Error extracting transactions from text:", error);
    throw new Error(
      `Failed to extract transactions: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Normalize and validate extracted transactions
 */
export function normalizeExtractedTransactions(
  extracted: ExtractedTransaction[],
  fileName?: string
): {
  transactions: InvestmentTransactionInput[];
  errors: string[];
} {
  const transactions: InvestmentTransactionInput[] = [];
  const errors: string[] = [];

  extracted.forEach((tx, index) => {
    try {
      // Parse date
      let date: Date;
      try {
        date = new Date(tx.date);
        if (isNaN(date.getTime())) {
          errors.push(
            `Transaction ${index + 1}: Invalid date format "${tx.date}"`
          );
          return;
        }
      } catch {
        errors.push(`Transaction ${index + 1}: Could not parse date "${tx.date}"`);
        return;
      }

      // Validate type
      const validTypes = [
        "buy",
        "sell",
        "dividend",
        "interest",
        "transfer_in",
        "transfer_out",
      ];
      if (!validTypes.includes(tx.type)) {
        errors.push(
          `Transaction ${index + 1}: Invalid type "${tx.type}". Must be one of: ${validTypes.join(", ")}`
        );
        return;
      }

      // Validate buy/sell transactions
      if (tx.type === "buy" || tx.type === "sell") {
        if (!tx.quantity || tx.quantity <= 0 || isNaN(tx.quantity)) {
          errors.push(
            `Transaction ${index + 1}: ${tx.type} transaction requires valid quantity > 0 (found: ${tx.quantity})`
          );
          return;
        }
        if (!tx.price || tx.price <= 0 || isNaN(tx.price)) {
          errors.push(
            `Transaction ${index + 1}: ${tx.type} transaction requires valid price > 0 (found: ${tx.price})`
          );
          return;
        }
        // Validate that quantity and price are reasonable numbers
        if (tx.quantity > 1000000 || tx.price > 1000000) {
          errors.push(
            `Transaction ${index + 1}: ${tx.type} transaction has suspiciously large values (quantity: ${tx.quantity}, price: ${tx.price})`
          );
          return;
        }
      }

      // Validate dividend/interest transactions
      if (tx.type === "dividend" || tx.type === "interest") {
        if (!tx.amount || tx.amount <= 0 || isNaN(tx.amount)) {
          errors.push(
            `Transaction ${index + 1}: ${tx.type} transaction requires valid amount > 0 (found: ${tx.amount})`
          );
          return;
        }
        // Validate that amount is reasonable
        if (tx.amount > 1000000) {
          errors.push(
            `Transaction ${index + 1}: ${tx.type} transaction has suspiciously large amount: ${tx.amount}`
          );
          return;
        }
      }

      // Build transaction input
      const transaction: InvestmentTransactionInput = {
        date,
        accountId: "", // Will be set by the caller based on account mapping
        type: tx.type,
        notes: tx.notes || undefined,
        securitySymbol: tx.symbol,
        securityName: tx.securityName,
      };

      if (tx.type === "buy" || tx.type === "sell") {
        transaction.quantity = Number(tx.quantity);
        transaction.price = Number(tx.price);
        transaction.fees = tx.fees ? Number(tx.fees) : 0;
        
        // Additional validation for numeric values
        if (isNaN(transaction.quantity!) || isNaN(transaction.price!) || isNaN(transaction.fees!)) {
          errors.push(
            `Transaction ${index + 1}: ${tx.type} transaction has invalid numeric values`
          );
          return;
        }
      } else if (tx.type === "dividend" || tx.type === "interest") {
        // For dividends/interest, use amount as price field
        transaction.price = Number(tx.amount);
        transaction.fees = 0;
        
        if (isNaN(transaction.price!)) {
          errors.push(
            `Transaction ${index + 1}: ${tx.type} transaction has invalid amount value`
          );
          return;
        }
      } else {
        // For transfers, fees are optional
        transaction.fees = tx.fees ? Number(tx.fees) : 0;
        
        if (tx.fees && isNaN(transaction.fees)) {
          errors.push(
            `Transaction ${index + 1}: transfer transaction has invalid fees value`
          );
          return;
        }
      }

      transactions.push(transaction);
    } catch (error) {
      errors.push(
        `Transaction ${index + 1}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  });

  return { transactions, errors };
}

/**
 * Main function to extract transactions from PDF
 */
export async function extractTransactionsFromPDF(
  pdfBuffer: Buffer,
  fileName?: string
): Promise<PDFExtractionResult> {
  try {
    // Extract text from PDF
    const rawText = await extractTextFromPDF(pdfBuffer);

    if (!rawText || rawText.trim().length === 0) {
      return {
        transactions: [],
        rawText,
        errors: ["PDF appears to be empty or could not extract text"],
      };
    }

    // Extract transactions using AI
    const extracted = await extractTransactionsFromText(rawText, fileName);

    // Normalize and validate
    const { transactions, errors } = normalizeExtractedTransactions(
      extracted,
      fileName
    );

    return {
      transactions,
      rawText,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    return {
      transactions: [],
      errors: [
        error instanceof Error ? error.message : "Failed to extract transactions from PDF",
      ],
    };
  }
}

