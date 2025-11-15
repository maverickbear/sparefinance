import Papa from "papaparse";

export interface CSVRow {
  [key: string]: string | undefined;
}

export interface ColumnMapping {
  date?: string;
  amount?: string;
  description?: string;
  account?: string;
  toAccount?: string; // For transfer transactions
  category?: string;
  subcategory?: string;
  type?: string;
}

export interface AccountMapping {
  [csvAccountName: string]: string; // Maps CSV account name to account ID
}

export function parseCSV(file: File): Promise<CSVRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => {
        // Clean up header names - remove BOM and trim whitespace
        return header.replace(/^\uFEFF/, '').trim();
      },
      complete: (results) => {
        console.log(`[parseCSV] Parsed ${results.data.length} rows from ${file.name}`);
        if (results.errors && results.errors.length > 0) {
          console.warn(`[parseCSV] Parse errors:`, results.errors);
        }
        if (results.data.length > 0) {
          console.log(`[parseCSV] First row:`, results.data[0]);
          console.log(`[parseCSV] Column names:`, Object.keys(results.data[0] as CSVRow));
        }
        resolve(results.data as CSVRow[]);
      },
      error: (error) => {
        console.error(`[parseCSV] Parse error for ${file.name}:`, error);
        reject(error);
      },
    });
  });
}

export async function parseCSVs(files: File[]): Promise<Map<number, CSVRow[]>> {
  const parsedFiles = new Map<number, CSVRow[]>();
  
  await Promise.all(
    files.map(async (file, index) => {
      try {
        const rows = await parseCSV(file);
        parsedFiles.set(index, rows);
      } catch (error) {
        console.error(`[parseCSVs] Error parsing file ${file.name}:`, error);
        // Continue with other files even if one fails
      }
    })
  );
  
  return parsedFiles;
}

interface Account {
  id: string;
  name: string;
}

interface Subcategory {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
  subcategories?: Subcategory[];
}

interface TransactionInput {
  date: Date;
  type: string;
  amount: number;
  accountId?: string;
  toAccountId?: string; // For transfer transactions
  categoryId?: string;
  subcategoryId?: string;
  description?: string;
}

export interface MapResult {
  transaction?: TransactionInput;
  error?: string;
  rowIndex: number;
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

export function mapCSVToTransactions(
  rows: CSVRow[],
  mapping: ColumnMapping,
  accounts: Account[],
  categories: Category[],
  accountMapping?: AccountMapping,
  defaultAccountId?: string
): MapResult[] {
  return rows.map((row, index) => {
    try {
      const dateStr = mapping.date ? row[mapping.date] : undefined;
      let date: Date;
      
      if (dateStr) {
        // Try to parse the date - handle common formats
        const parsedDate = new Date(dateStr);
        if (isNaN(parsedDate.getTime())) {
          return {
            rowIndex: index + 1,
            error: `Invalid date format: ${dateStr}`,
          };
        }
        date = parsedDate;
      } else {
        date = new Date();
      }
      
      const amountStr = mapping.amount ? row[mapping.amount] : "0";
      const cleanedAmount = amountStr?.replace(/[^0-9.-]/g, "") || "0";
      const amount = parseFloat(cleanedAmount);
      
      if (isNaN(amount) || amount === 0) {
        return {
          rowIndex: index + 1,
          error: `Invalid amount: ${amountStr}`,
        };
      }
      
      const description = mapping.description ? row[mapping.description] : "";
      const accountName = mapping.account ? row[mapping.account]?.trim() : "";
      const toAccountName = mapping.toAccount ? row[mapping.toAccount]?.trim() : "";
      const categoryName = mapping.category ? row[mapping.category] : "";
      const subcategoryName = mapping.subcategory ? row[mapping.subcategory] : "";
      
      // Normalize transaction type
      let type = (mapping.type ? row[mapping.type]?.toLowerCase().trim() : "expense") || "expense";
      if (!["expense", "income", "transfer"].includes(type)) {
        // Default to expense if type is invalid
        type = "expense";
      }

      // Find account using mapping or direct match (case-insensitive)
      let account: Account | undefined;
      
      if (accountMapping && accountName && accountMapping[accountName]) {
        // Use explicit mapping
        account = accounts.find((a) => a.id === accountMapping[accountName]);
      } else if (accountName) {
        // Try exact match first
        account = accounts.find((a) => a.name === accountName);
        
        // If not found, try case-insensitive match
        if (!account) {
          account = accounts.find((a) => a.name.toLowerCase() === accountName.toLowerCase());
        }
      }
      
      // Find toAccount for transfers
      let toAccount: Account | undefined;
      if (type === "transfer" && toAccountName) {
        if (accountMapping && accountMapping[toAccountName]) {
          // Use explicit mapping
          toAccount = accounts.find((a) => a.id === accountMapping[toAccountName]);
        } else {
          // Try exact match first
          toAccount = accounts.find((a) => a.name === toAccountName);
          
          // If not found, try case-insensitive match
          if (!toAccount) {
            toAccount = accounts.find((a) => a.name.toLowerCase() === toAccountName.toLowerCase());
          }
        }
      }
      
      const category = categories.find((c) => c.name === categoryName);
      const subcategory = category?.subcategories?.find((s) => s.name === subcategoryName);

      // Use default account if no account found and defaultAccountId is provided
      if (!account?.id) {
        if (defaultAccountId && defaultAccountId !== "__none__") {
          account = accounts.find((a) => a.id === defaultAccountId);
        }
        
        if (!account?.id) {
          return {
            rowIndex: index + 1,
            error: `Account not found: "${accountName}". Available accounts: ${accounts.map(a => a.name).join(", ")}`,
          };
        }
      }

      // Validate transfer requirements
      if (type === "transfer") {
        if (!toAccountName) {
          return {
            rowIndex: index + 1,
            error: `Transfer transaction requires a destination account (toAccount). Please map the "To Account" column.`,
          };
        }
        if (!toAccount?.id) {
          return {
            rowIndex: index + 1,
            error: `Destination account not found: "${toAccountName}". Available accounts: ${accounts.map(a => a.name).join(", ")}`,
          };
        }
        if (account.id === toAccount.id) {
          return {
            rowIndex: index + 1,
            error: `Transfer requires different source and destination accounts. Both are: "${accountName}"`,
          };
        }
      }

      return {
        rowIndex: index + 1,
        transaction: {
          date,
          type: type as "expense" | "income" | "transfer",
          amount: Math.abs(amount), // Ensure positive amount
          accountId: account.id,
          toAccountId: type === "transfer" && toAccount?.id ? toAccount.id : undefined,
          categoryId: category?.id,
          subcategoryId: subcategory?.id,
          description: description || "",
        },
      };
    } catch (error) {
      return {
        rowIndex: index + 1,
        error: error instanceof Error ? error.message : `Error processing row ${index + 1}`,
      };
    }
  });
}

