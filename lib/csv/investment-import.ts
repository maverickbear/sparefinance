import Papa from "papaparse";
import { parseCSV, CSVRow } from "./import";

export interface InvestmentCSVRow extends CSVRow {
  [key: string]: string | undefined;
}

export interface InvestmentColumnMapping {
  date?: string;
  symbol?: string;
  securityName?: string;
  type?: string; // buy, sell, dividend, interest, transfer_in, transfer_out
  quantity?: string;
  price?: string;
  fees?: string;
  amount?: string; // For dividends, interest, transfers
  account?: string;
  notes?: string;
  currency?: string;
}

export interface InvestmentAccountMapping {
  [csvAccountName: string]: string; // Maps CSV account name to account ID
}

export interface SecurityMapping {
  [csvSymbol: string]: string; // Maps CSV symbol to security ID
}

export interface InvestmentTransactionInput {
  date: Date;
  accountId: string;
  securityId?: string;
  type: "buy" | "sell" | "dividend" | "interest" | "transfer_in" | "transfer_out";
  quantity?: number;
  price?: number;
  fees?: number;
  notes?: string;
  // For creating security if it doesn't exist
  securitySymbol?: string;
  securityName?: string;
  securityClass?: string; // Stock, ETF, Crypto, Fund
}

export interface InvestmentMapResult {
  transaction?: InvestmentTransactionInput;
  error?: string;
  rowIndex: number;
  fileIndex?: number;
  fileName?: string;
}

/**
 * Parse multiple CSV files for investment transactions
 */
export async function parseInvestmentCSVs(files: File[]): Promise<Map<number, CSVRow[]>> {
  const results = new Map<number, CSVRow[]>();
  
  await Promise.all(
    files.map(async (file, index) => {
      try {
        const rows = await parseCSV(file);
        console.log(`[parseInvestmentCSVs] File ${file.name}: parsed ${rows.length} rows`);
        if (rows.length > 0) {
          console.log(`[parseInvestmentCSVs] First row keys:`, Object.keys(rows[0]));
        }
        results.set(index, rows);
      } catch (error) {
        console.error(`Error parsing file ${file.name}:`, error);
        results.set(index, []);
      }
    })
  );
  
  return results;
}

/**
 * Normalize transaction type from CSV
 */
function normalizeTransactionType(typeStr: string | undefined, description?: string): "buy" | "sell" | "dividend" | "interest" | "transfer_in" | "transfer_out" {
  if (!typeStr) {
    // If no type string, try to infer from description
    if (description) {
      const descLower = description.toLowerCase();
      if (descLower.includes("contribution") && !descLower.includes("purchase")) {
        return "transfer_in";
      }
      if (descLower.includes("purchase of") || descLower.includes("bought")) {
        return "buy";
      }
      if (descLower.includes("sale of") || descLower.includes("sold")) {
        return "sell";
      }
    }
    return "buy";
  }
  
  const normalized = typeStr.toUpperCase().trim();
  
  // Wealthsimple format: DIV, BUY, SELL, etc.
  if (normalized === "DIV" || normalized === "DIVIDEND") {
    return "dividend";
  }
  if (normalized === "BUY" || normalized === "PURCHASE") {
    return "buy";
  }
  if (normalized === "SELL" || normalized === "SALE") {
    return "sell";
  }
  if (normalized === "INT" || normalized === "INTEREST") {
    return "interest";
  }
  if (normalized === "CONTRIBUTION" || normalized === "DEPOSIT") {
    return "transfer_in";
  }
  if (normalized === "WITHDRAWAL" || normalized === "WITHDRAW") {
    return "transfer_out";
  }
  
  // Common variations (lowercase)
  const lowerNormalized = normalized.toLowerCase();
  if (lowerNormalized.includes("contribution") || (lowerNormalized.includes("deposit") && !lowerNormalized.includes("purchase"))) {
    return "transfer_in";
  }
  if (lowerNormalized.includes("buy") || lowerNormalized.includes("purchase") || lowerNormalized.includes("compra")) {
    return "buy";
  }
  if (lowerNormalized.includes("sell") || lowerNormalized.includes("sale") || lowerNormalized.includes("venda")) {
    return "sell";
  }
  if (lowerNormalized.includes("dividend") || lowerNormalized.includes("dividendo")) {
    return "dividend";
  }
  if (lowerNormalized.includes("interest") || lowerNormalized.includes("juros")) {
    return "interest";
  }
  if (lowerNormalized.includes("transfer_in") || lowerNormalized.includes("deposit") || lowerNormalized.includes("deposito")) {
    return "transfer_in";
  }
  if (lowerNormalized.includes("transfer_out") || lowerNormalized.includes("withdrawal") || lowerNormalized.includes("saque")) {
    return "transfer_out";
  }
  
  // Default to buy
  return "buy";
}

/**
 * Extract symbol from Wealthsimple description
 * Examples: 
 * - "XDV - BlackRock Canada iShares..." -> "XDV"
 * - "Purchase of 0.0301820700 ETH" -> "ETH"
 * - "Purchase of 0.2118693900 SOL" -> "SOL"
 * - "0.0069381300 BTC" -> "BTC"
 */
function extractSymbolFromDescription(description: string | undefined): string | undefined {
  if (!description) return undefined;
  
  // Pattern 1: "SYMBOL - " or "SYMBOL:" at the start (traditional format)
  let match = description.match(/^([A-Z0-9]+)\s*[-:]/);
  if (match && match[1]) {
    return match[1].toUpperCase();
  }
  
  // Pattern 2: "Purchase of X.XXXXX SYMBOL" or "X.XXXXX SYMBOL" (crypto format)
  // Common crypto symbols: BTC, ETH, SOL, ADA, DOT, MATIC, AVAX, etc.
  match = description.match(/(?:purchase|purchased|bought)\s+of\s+[\d.,]+\s+([A-Z]{2,10})\b/i);
  if (match && match[1]) {
    return match[1].toUpperCase();
  }
  
  // Pattern 3: "X.XXXXX SYMBOL" (standalone crypto format)
  match = description.match(/[\d.,]+\s+([A-Z]{2,10})\b/i);
  if (match && match[1]) {
    const symbol = match[1].toUpperCase();
    // Validate it's likely a crypto symbol (2-10 uppercase letters, common cryptos)
    const commonCryptos = ['BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'MATIC', 'AVAX', 'LINK', 'UNI', 'ATOM', 'ALGO', 'XRP', 'DOGE', 'LTC', 'BCH', 'ETC', 'XLM', 'EOS', 'TRX', 'XMR', 'DASH', 'ZEC', 'USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'PAXG', 'WBTC'];
    if (commonCryptos.includes(symbol) || symbol.length >= 2) {
      return symbol;
    }
  }
  
  return undefined;
}

/**
 * Extract quantity from Wealthsimple description for BUY transactions
 * Examples: 
 * - "Bought 0.0003 shares" -> 0.0003
 * - "Purchased 10 shares" -> 10
 * - "0.5 shares" -> 0.5
 * - "Qty: 100" -> 100
 * - "Purchase of 0.0301820700 ETH" -> 0.0301820700
 * - "Purchase of 0.2118693900 SOL" -> 0.2118693900
 * - "0.0069381300 BTC" -> 0.0069381300
 */
function extractQuantityFromDescription(description: string | undefined): number | undefined {
  if (!description) return undefined;
  
  // Pattern 1: "Purchase of X.XXXXX SYMBOL" or "Purchased X.XXXXX SYMBOL" (crypto format)
  // Matches: "Purchase of 0.0301820700 ETH" -> 0.0301820700
  let match = description.match(/(?:purchase|purchased|bought)\s+of\s+([\d.,]+)\s+([A-Z]{2,10})\b/i);
  if (match && match[1]) {
    const quantity = parseFloat(match[1].replace(/,/g, ""));
    if (!isNaN(quantity) && quantity > 0) return quantity;
  }
  
  // Pattern 2: "X.XXXXX SYMBOL" at start or after "of" (crypto format)
  // Matches: "0.0301820700 ETH" or "of 0.0301820700 ETH"
  match = description.match(/(?:^|\s+of\s+)([\d.,]+)\s+([A-Z]{2,10})\b/i);
  if (match && match[1]) {
    const quantity = parseFloat(match[1].replace(/,/g, ""));
    if (!isNaN(quantity) && quantity > 0) return quantity;
  }
  
  // Pattern 3: "Bought X shares" or "Purchased X shares" (traditional format)
  match = description.match(/(?:bought|purchased)\s+([\d.,]+)\s+shares/i);
  if (match && match[1]) {
    const quantity = parseFloat(match[1].replace(/,/g, ""));
    if (!isNaN(quantity) && quantity > 0) return quantity;
  }
  
  // Pattern 4: "X shares" (standalone)
  match = description.match(/([\d.,]+)\s+shares/i);
  if (match && match[1]) {
    const quantity = parseFloat(match[1].replace(/,/g, ""));
    if (!isNaN(quantity) && quantity > 0) return quantity;
  }
  
  // Pattern 5: "Qty: X" or "Quantity: X"
  match = description.match(/(?:qty|quantity)[:\s]+([\d.,]+)/i);
  if (match && match[1]) {
    const quantity = parseFloat(match[1].replace(/,/g, ""));
    if (!isNaN(quantity) && quantity > 0) return quantity;
  }
  
  // Pattern 6: Just a number followed by "shares" or at the start
  match = description.match(/^([\d.,]+)\s*(?:shares|units|units?)?/i);
  if (match && match[1]) {
    const quantity = parseFloat(match[1].replace(/,/g, ""));
    if (!isNaN(quantity) && quantity > 0) return quantity;
  }
  
  return undefined;
}

/**
 * Parse date from various formats
 */
function parseDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  
  // Try common formats
  const formats = [
    /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
    /(\d{2})\/(\d{2})\/(\d{4})/, // MM/DD/YYYY
    /(\d{2})\/(\d{2})\/(\d{2})/, // MM/DD/YY
    /(\d{4})\/(\d{2})\/(\d{2})/, // YYYY/MM/DD
  ];
  
  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      let year, month, day;
      
      if (format === formats[0]) {
        // YYYY-MM-DD
        [, year, month, day] = match;
      } else if (format === formats[1]) {
        // MM/DD/YYYY
        [, month, day, year] = match;
      } else if (format === formats[2]) {
        // MM/DD/YY
        [, month, day, year] = match;
        year = "20" + year;
      } else {
        // YYYY/MM/DD
        [, year, month, day] = match;
      }
      
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }
  
  // Fallback to Date constructor
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Clean and parse number from string
 */
function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  
  // Remove currency symbols, commas, and other non-numeric characters except decimal point and minus
  const cleaned = value.replace(/[^\d.-]/g, "");
  const parsed = parseFloat(cleaned);
  
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Infer security class from symbol
 */
function inferSecurityClass(symbol: string | undefined): string {
  if (!symbol) return "Stock";
  
  const upperSymbol = symbol.toUpperCase();
  
  // Common ETF patterns
  if (upperSymbol.includes("ETF") || 
      upperSymbol.startsWith("VFV") || 
      upperSymbol.startsWith("XEQT") || 
      upperSymbol.startsWith("VOO") ||
      upperSymbol.startsWith("TTP") ||
      upperSymbol.startsWith("XDV")) {
    return "ETF";
  }
  
  // Crypto patterns
  if (upperSymbol.startsWith("BTC") || 
      upperSymbol.startsWith("ETH") || 
      upperSymbol.includes("CRYPTO")) {
    return "Crypto";
  }
  
  // Default to Stock
  return "Stock";
}

/**
 * Map CSV rows to investment transactions
 */
export function mapCSVToInvestmentTransactions(
  rows: CSVRow[],
  mapping: InvestmentColumnMapping,
  accounts: Array<{ id: string; name: string }>,
  securities: Array<{ id: string; symbol: string }>,
  accountMapping?: InvestmentAccountMapping,
  securityMapping?: SecurityMapping,
  fileIndex?: number,
  fileName?: string,
  defaultAccountId?: string
): InvestmentMapResult[] {
  return rows.map((row, index) => {
    try {
      // Parse date
      const dateStr = mapping.date ? row[mapping.date] : undefined;
      const date = parseDate(dateStr);
      if (!date) {
        return {
          rowIndex: index + 1,
          fileIndex,
          fileName,
          error: `Invalid or missing date: ${dateStr}`,
        };
      }
      
      // Get account - try column first, then filename, then defaultAccountId, then accountMapping fallback
      let accountName = mapping.account ? row[mapping.account]?.trim() : "";
      
      // If no account in column, try to extract from filename (Wealthsimple format)
      // Example: "RRSP-monthly-statement-transactions-..." -> "RRSP"
      if (!accountName && fileName) {
        const filenameMatch = fileName.match(/^([A-Z]+)-/i);
        if (filenameMatch && filenameMatch[1]) {
          accountName = filenameMatch[1].toUpperCase();
        }
      }
      
      let accountId: string | undefined;
      
      // Try defaultAccountId first if no account name found
      if (!accountName && defaultAccountId && defaultAccountId !== "__none__") {
        accountId = defaultAccountId;
      } else if (accountMapping && accountName && accountMapping[accountName]) {
        accountId = accountMapping[accountName];
      } else if (accountName) {
        const account = accounts.find(
          (a) => a.name.toUpperCase() === accountName.toUpperCase()
        );
        accountId = account?.id;
      }
      
      if (!accountId) {
        return {
          rowIndex: index + 1,
          fileIndex,
          fileName,
          error: `Account not found: "${accountName || "(empty)"}". Available accounts: ${accounts.map(a => a.name).join(", ")}. ${fileName ? `Tried to extract from filename "${fileName}" but no match found.` : ""} ${defaultAccountId && defaultAccountId !== "__none__" ? `Default account was set but not found.` : "Please set a default account or ensure account column is mapped."}`,
        };
      }
      
      // Get transaction type
      const typeStr = mapping.type ? row[mapping.type] : undefined;
      const description = mapping.notes ? row[mapping.notes] : undefined;
      let type = normalizeTransactionType(typeStr, description);
      
      // If type is "buy" but description indicates "Contribution", override to transfer_in
      // This handles cases where CSV has "BUY" but description says "Contribution"
      if (type === "buy" && description) {
        const descLower = description.toLowerCase();
        if (descLower.includes("contribution") && !descLower.includes("purchase") && !descLower.includes("bought")) {
          type = "transfer_in";
        }
      }
      
      // Description already retrieved above for type normalization
      
      // Get symbol - try explicit column first, then extract from description
      let symbol = mapping.symbol ? row[mapping.symbol]?.trim().toUpperCase() : undefined;
      if (!symbol && description) {
        symbol = extractSymbolFromDescription(description);
      }
      
      let securityId: string | undefined;
      
      if (symbol) {
        if (securityMapping && securityMapping[symbol]) {
          securityId = securityMapping[symbol];
        } else {
          const security = securities.find(
            (s) => s.symbol.toUpperCase() === symbol
          );
          securityId = security?.id;
        }
      }
      
      // For buy/sell, we need quantity and price
      if (type === "buy" || type === "sell") {
        // Try to get quantity from column, or extract from description (Wealthsimple format)
        let quantity = parseNumber(mapping.quantity ? row[mapping.quantity] : undefined);
        if (!quantity && description) {
          quantity = extractQuantityFromDescription(description);
        }
        
        // Get amount (total cost for buy, total proceeds for sell)
        const amount = parseNumber(mapping.amount ? row[mapping.amount] : mapping.price ? row[mapping.price] : undefined);
        // For Wealthsimple, amount is negative for BUY (cost), positive for SELL (proceeds)
        const absoluteAmount = amount ? Math.abs(amount) : undefined;
        
        // Get price - if we have amount and quantity, calculate price per share
        let price = parseNumber(mapping.price ? row[mapping.price] : undefined);
        if (!price && absoluteAmount && quantity && quantity > 0) {
          price = absoluteAmount / quantity;
        }
        
        // If we still don't have quantity, try to calculate from amount and price
        if ((!quantity || quantity <= 0) && absoluteAmount && price && price > 0) {
          quantity = absoluteAmount / price;
        }
        
        if (!quantity || quantity <= 0) {
          return {
            rowIndex: index + 1,
            fileIndex,
            fileName,
            error: `Invalid quantity for ${type} transaction. Found: ${mapping.quantity ? row[mapping.quantity] : "missing"}. ${description ? `Tried to extract from description "${description.substring(0, 50)}..." but failed.` : ""} ${absoluteAmount && price ? `Tried to calculate from amount (${absoluteAmount}) / price (${price}) but result is invalid.` : ""}`,
          };
        }
        
        if (!price || price <= 0) {
          return {
            rowIndex: index + 1,
            fileIndex,
            fileName,
            error: `Invalid price for ${type} transaction. Found: ${mapping.price ? row[mapping.price] : "missing"}. ${absoluteAmount && quantity ? `Tried to calculate from amount (${absoluteAmount}) / quantity (${quantity}) but result is invalid.` : "Need price column or amount column with quantity."}`,
          };
        }
        
        if (!symbol) {
          return {
            rowIndex: index + 1,
            fileIndex,
            fileName,
            error: `Symbol is required for ${type} transaction. ${description ? "Tried to extract from description but failed." : "Please map symbol column or ensure description contains symbol."}`,
          };
        }
        
        const fees = parseNumber(mapping.fees ? row[mapping.fees] : undefined) || 0;
        const notes = description || (mapping.notes ? row[mapping.notes] : undefined);
        const securityName = mapping.securityName ? row[mapping.securityName] : symbol;
        
        return {
          rowIndex: index + 1,
          fileIndex,
          fileName,
          transaction: {
            date,
            accountId,
            securityId,
            type,
            quantity,
            price,
            fees,
            notes,
            securitySymbol: symbol,
            securityName,
            securityClass: inferSecurityClass(symbol),
          },
        };
      }
      
      // For dividend/interest, amount is the dividend/interest value
      if (type === "dividend" || type === "interest") {
        // Get amount (can be negative in some formats, convert to absolute)
        const amountRaw = parseNumber(mapping.amount ? row[mapping.amount] : mapping.price ? row[mapping.price] : undefined);
        // Convert to absolute value since dividends/interest should be positive
        const amount = amountRaw ? Math.abs(amountRaw) : undefined;
        
        if (!amount || amount <= 0) {
          return {
            rowIndex: index + 1,
            fileIndex,
            fileName,
            error: `Invalid amount for ${type} transaction: ${mapping.amount ? row[mapping.amount] : mapping.price ? row[mapping.price] : "missing"}. ${amountRaw !== undefined ? `Parsed as ${amountRaw}, converted to absolute ${amount}.` : ""}`,
          };
        }
        
        // Try to extract symbol from description if not in symbol column
        if (!symbol && description) {
          symbol = extractSymbolFromDescription(description);
        }
        
        const notes = description || (mapping.notes ? row[mapping.notes] : undefined);
        
        return {
          rowIndex: index + 1,
          fileIndex,
          fileName,
          transaction: {
            date,
            accountId,
            securityId: symbol ? securityId : undefined,
            type,
            quantity: undefined, // Dividends don't have quantity
            price: amount, // Use amount as the dividend value
            fees: 0,
            notes,
            securitySymbol: symbol,
            securityName: mapping.securityName ? row[mapping.securityName] : symbol || "Unknown",
            securityClass: symbol ? inferSecurityClass(symbol) : "Stock",
          },
        };
      }
      
      // For transfers, amount is optional (transfers don't affect holdings)
      if (type === "transfer_in" || type === "transfer_out") {
        const amount = parseNumber(mapping.amount ? row[mapping.amount] : mapping.price ? row[mapping.price] : undefined);
        const notes = mapping.notes ? row[mapping.notes] : undefined;
        
        return {
          rowIndex: index + 1,
          fileIndex,
          fileName,
          transaction: {
            date,
            accountId,
            type,
            fees: 0,
            notes,
          },
        };
      }
      
      return {
        rowIndex: index + 1,
        fileIndex,
        fileName,
        error: `Unsupported transaction type: ${type}`,
      };
    } catch (error) {
      return {
        rowIndex: index + 1,
        fileIndex,
        fileName,
        error: error instanceof Error ? error.message : `Error processing row ${index + 1}`,
      };
    }
  });
}

/**
 * Extract unique symbols from CSV rows
 */
export function extractUniqueSymbols(
  rows: CSVRow[],
  symbolColumn: string
): string[] {
  const symbols = new Set<string>();
  rows.forEach((row) => {
    const symbol = row[symbolColumn]?.trim().toUpperCase();
    if (symbol) {
      symbols.add(symbol);
    }
  });
  return Array.from(symbols).sort();
}

/**
 * Extract unique account names from CSV rows
 */
export function extractUniqueAccountNames(
  rows: CSVRow[],
  accountColumn: string
): string[] {
  const accountNames = new Set<string>();
  rows.forEach((row) => {
    const accountName = row[accountColumn]?.trim();
    if (accountName) {
      accountNames.add(accountName);
    }
  });
  return Array.from(accountNames).sort();
}

