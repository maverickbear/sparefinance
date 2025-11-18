"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { 
  parseInvestmentCSVs, 
  mapCSVToInvestmentTransactions,
  InvestmentColumnMapping,
  InvestmentAccountMapping,
  SecurityMapping,
  extractUniqueSymbols,
  extractUniqueAccountNames,
  CSVRow,
} from "@/lib/csv/investment-import";
import { useSubscription } from "@/hooks/use-subscription";
import { UpgradePrompt } from "@/components/billing/upgrade-prompt";
import { Loader2, AlertCircle, CheckCircle2, X, Upload, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Account {
  id: string;
  name: string;
}

interface Security {
  id: string;
  symbol: string;
  name: string;
}

interface InvestmentCsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface FileData {
  file: File;
  rows: CSVRow[];
  availableColumns: string[];
  uniqueAccountNames: string[];
  uniqueSymbols: string[];
}

export function InvestmentCsvImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: InvestmentCsvImportDialogProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [filesData, setFilesData] = useState<Map<number, FileData>>(new Map());
  const [mapping, setMapping] = useState<InvestmentColumnMapping>({});
  const [accountMapping, setAccountMapping] = useState<InvestmentAccountMapping>({});
  const [securityMapping, setSecurityMapping] = useState<SecurityMapping>({});
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [securities, setSecurities] = useState<Security[]>([]);
  const [defaultAccountId, setDefaultAccountId] = useState<string>("");
  const [isImporting, setIsImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importSuccess, setImportSuccess] = useState<{ imported: number; errors: number } | null>(null);
  const { limits, checking: limitsLoading } = useSubscription();
  const { toast } = useToast();

  // Load accounts and securities when dialog opens
  useEffect(() => {
    if (open) {
      loadAccountsAndSecurities();
    } else {
      // Reset state when dialog closes
      setFiles([]);
      setFilesData(new Map());
      setMapping({});
      setAccountMapping({});
      setSecurityMapping({});
      setDefaultAccountId("");
      setImportErrors([]);
      setImportSuccess(null);
    }
  }, [open]);

  async function loadAccountsAndSecurities() {
    try {
      const [accountsRes, securitiesRes] = await Promise.all([
        fetch("/api/investments/accounts"),
        fetch("/api/investments/securities"),
      ]);

      if (accountsRes.ok) {
        const accountsData = await accountsRes.json().catch(() => []);
        setAccounts(accountsData.map((acc: any) => ({ id: acc.id, name: acc.name })));
      }

      if (securitiesRes.ok) {
        const securitiesData = await securitiesRes.json().catch(() => []);
        setSecurities(securitiesData.map((sec: any) => ({ id: sec.id, symbol: sec.symbol, name: sec.name })));
      }
    } catch (error) {
      console.error("Error loading accounts and securities:", error);
      toast({
        title: "Error",
        description: "Failed to load accounts and securities",
        variant: "destructive",
      });
    }
  }

  const handleFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    setFiles(selectedFiles);
    setAccountMapping({});
    setSecurityMapping({});
    setImportErrors([]);
    setImportSuccess(null);

    try {
      const parsedFiles = await parseInvestmentCSVs(selectedFiles);
      const newFilesData = new Map<number, FileData>();
      const parseErrors: string[] = [];

      console.log(`[handleFilesChange] Parsed ${parsedFiles.size} files`);

      for (let i = 0; i < selectedFiles.length; i++) {
        const rows = parsedFiles.get(i) || [];
        console.log(`[handleFilesChange] File ${selectedFiles[i].name}: ${rows.length} rows`);
        
        if (rows.length > 0) {
          const availableColumns = Object.keys(rows[0]);
          console.log(`[handleFilesChange] File ${selectedFiles[i].name}: columns =`, availableColumns);
          
          if (availableColumns.length === 0) {
            parseErrors.push(`${selectedFiles[i].name}: No columns found`);
            continue;
          }
          
          // Filter out empty column names (can happen with malformed CSVs)
          const validColumns = availableColumns.filter(col => col && col.trim().length > 0);
          if (validColumns.length === 0) {
            parseErrors.push(`${selectedFiles[i].name}: No valid column names found`);
            continue;
          }
          
          // Extract unique values for mapping
          let uniqueAccountNames: string[] = [];
          let uniqueSymbols: string[] = [];
          
          if (mapping.account) {
            uniqueAccountNames = extractUniqueAccountNames(rows, mapping.account);
          }
          if (mapping.symbol) {
            uniqueSymbols = extractUniqueSymbols(rows, mapping.symbol);
          }

          newFilesData.set(i, {
            file: selectedFiles[i],
            rows,
            availableColumns: validColumns,
            uniqueAccountNames,
            uniqueSymbols,
          });
        } else {
          parseErrors.push(`${selectedFiles[i].name}: No rows found or file is empty. Make sure the file has a header row and at least one data row.`);
        }
      }

      console.log(`[handleFilesChange] Valid files: ${newFilesData.size}, Errors: ${parseErrors.length}`);

      if (parseErrors.length > 0 && newFilesData.size === 0) {
        const errorMessage = parseErrors.length === 1 
          ? parseErrors[0]
          : `Failed to parse all CSV files:\n${parseErrors.join("\n")}`;
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      } else if (parseErrors.length > 0) {
        toast({
          title: "Warning",
          description: `Some files had issues:\n${parseErrors.join("\n")}\n\nContinuing with ${newFilesData.size} valid file(s).`,
          variant: "default",
        });
      }

      setFilesData(newFilesData);

      // Auto-detect common column names
      if (newFilesData.size > 0) {
        const firstFileData = Array.from(newFilesData.values())[0];
        const columns = firstFileData.availableColumns;
        const autoMapping: InvestmentColumnMapping = { ...mapping };

        // Common column name patterns (including Wealthsimple format)
        columns.forEach((col) => {
          const colLower = col.toLowerCase();
          // Exact matches first (Wealthsimple format)
          if (!autoMapping.date && (colLower === "date" || colLower.includes("date") || colLower.includes("data"))) {
            autoMapping.date = col;
          }
          if (!autoMapping.type && (colLower === "transaction" || colLower.includes("type") || colLower.includes("tipo") || colLower.includes("action"))) {
            autoMapping.type = col;
          }
          if (!autoMapping.amount && (colLower === "amount" || colLower.includes("amount") || colLower.includes("valor") || colLower.includes("total"))) {
            autoMapping.amount = col;
          }
          if (!autoMapping.notes && (colLower === "description" || colLower.includes("note") || colLower.includes("description") || colLower.includes("nota"))) {
            autoMapping.notes = col;
          }
          if (!autoMapping.account && (colLower === "account" || colLower.includes("account") || colLower.includes("conta"))) {
            autoMapping.account = col;
          }
          // Other patterns
          if (!autoMapping.symbol && (colLower.includes("symbol") || colLower.includes("ticker") || colLower.includes("símbolo"))) {
            autoMapping.symbol = col;
          }
          if (!autoMapping.securityName && (colLower.includes("name") || colLower.includes("security") || colLower.includes("nome"))) {
            autoMapping.securityName = col;
          }
          if (!autoMapping.quantity && (colLower.includes("quantity") || colLower.includes("qty") || colLower.includes("shares") || colLower.includes("quantidade"))) {
            autoMapping.quantity = col;
          }
          if (!autoMapping.price && (colLower.includes("price") || colLower.includes("preço") || colLower.includes("cost"))) {
            autoMapping.price = col;
          }
          if (!autoMapping.fees && (colLower.includes("fee") || colLower.includes("commission") || colLower.includes("taxa"))) {
            autoMapping.fees = col;
          }
        });

        setMapping(autoMapping);
      }
    } catch (error) {
      console.error("Error parsing CSV files:", error);
      toast({
        title: "Error",
        description: "Failed to parse CSV files",
        variant: "destructive",
      });
    }
  };

  const handleMappingChange = (field: keyof InvestmentColumnMapping, value: string | undefined) => {
    setMapping({ ...mapping, [field]: value });
    
    // Update unique values when account or symbol mapping changes
    if (field === "account" || field === "symbol") {
      const newFilesData = new Map(filesData);
      filesData.forEach((fileData, index) => {
        if (field === "account" && value && fileData.rows.length > 0) {
          const uniqueAccountNames = extractUniqueAccountNames(fileData.rows, value);
          newFilesData.set(index, { ...fileData, uniqueAccountNames });
        }
        if (field === "symbol" && value && fileData.rows.length > 0) {
          const uniqueSymbols = extractUniqueSymbols(fileData.rows, value);
          newFilesData.set(index, { ...fileData, uniqueSymbols });
        }
      });
      setFilesData(newFilesData);
    }
  };

  const handleImport = async () => {
    if (files.length === 0) return;

    setIsImporting(true);
    setImportErrors([]);
    setImportSuccess(null);

    try {
      // Collect all transactions from all files
      const allTransactions: any[] = [];
      const allErrors: string[] = [];

      filesData.forEach((fileData, fileIndex) => {
        const mapResults = mapCSVToInvestmentTransactions(
          fileData.rows,
          mapping,
          accounts,
          securities,
          accountMapping,
          securityMapping,
          fileIndex,
          fileData.file.name,
          defaultAccountId && defaultAccountId !== "__none__" ? defaultAccountId : undefined
        );

        mapResults.forEach((result) => {
          if (result.error) {
            const errorMsg = `File: ${result.fileName || "Unknown"}, Row ${result.rowIndex}: ${result.error}`;
            allErrors.push(errorMsg);
          } else if (result.transaction) {
            allTransactions.push({
              ...result.transaction,
              rowIndex: result.rowIndex,
              fileName: result.fileName,
            });
          }
        });
      });

      if (allErrors.length > 0) {
        setImportErrors(allErrors);
      }

      if (allTransactions.length === 0) {
        toast({
          title: "No valid transactions",
          description: "All rows had errors. Please check your CSV files and mapping.",
          variant: "destructive",
        });
        setIsImporting(false);
        return;
      }

      // Import transactions via API
      const response = await fetch("/api/investments/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: allTransactions }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to import transactions");
      }

      const result = await response.json();
      setImportSuccess({
        imported: result.imported || 0,
        errors: result.errors || 0,
      });

      if (result.errorDetails && result.errorDetails.length > 0) {
        const apiErrors = result.errorDetails.map(
          (e: any) => `File: ${e.fileName || "Unknown"}, Row ${e.rowIndex}: ${e.error}`
        );
        setImportErrors([...allErrors, ...apiErrors]);
      }

      toast({
        title: "Import completed",
        description: `Successfully imported ${result.imported} transactions. ${result.errors > 0 ? `${result.errors} errors occurred.` : ""}`,
        variant: result.errors > 0 ? "destructive" : ("success" as any),
      });

      if (result.imported > 0) {
        onSuccess?.();
        // Close dialog after a short delay
        setTimeout(() => {
          onOpenChange(false);
        }, 2000);
      }
    } catch (error) {
      console.error("Error importing transactions:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to import transactions",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    
    const newFilesData = new Map(filesData);
    newFilesData.delete(index);
    // Reindex remaining files
    const reindexed = new Map<number, FileData>();
    let newIndex = 0;
    newFiles.forEach((_, oldIndex) => {
      if (filesData.has(oldIndex)) {
        reindexed.set(newIndex, filesData.get(oldIndex)!);
        newIndex++;
      }
    });
    setFilesData(reindexed);
  };

  // Check if user has access to CSV import
  // The database is the source of truth - if a feature is disabled in Supabase, it should be disabled here
  // Safety check: convert string "true" to boolean (defensive programming)
  const hasCsvAccess = limits.hasCsvImport === true || String(limits.hasCsvImport) === "true";
  const firstFileData = filesData.size > 0 ? Array.from(filesData.values())[0] : null;
  const availableColumns = firstFileData?.availableColumns || [];
  
  // Check if we have at least one file with valid columns
  const hasValidFiles = filesData.size > 0 && availableColumns.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl sm:max-h-[90vh] flex flex-col !p-0 !gap-0">
        <DialogHeader>
          <DialogTitle>Import Investment Transactions from CSV</DialogTitle>
          <DialogDescription>
            Upload one or more monthly statement CSV files to import investment transactions
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
            {!hasCsvAccess && !limitsLoading && (
              <div>
                <UpgradePrompt
                  feature="CSV Import"
                  currentPlan="essential"
                  requiredPlan="essential"
                  message="CSV import is not available. Please upgrade to Essential or Pro to import your investment transactions."
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium">CSV Files (Monthly Statements)</label>
              <Input 
                type="file" 
                accept=".csv" 
                multiple 
                onChange={handleFilesChange}
                disabled={!hasCsvAccess}
              />
              <p className="text-xs text-muted-foreground mt-1">
                You can select multiple CSV files to import at once
              </p>
            </div>

            {files.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Selected Files:</label>
                <div className="space-y-1">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-md">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span className="text-sm">{file.name}</span>
                        {filesData.has(index) && (
                          <span className="text-xs text-muted-foreground">
                            ({filesData.get(index)?.rows.length || 0} rows)
                          </span>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="small"
                        onClick={() => removeFile(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!hasValidFiles && files.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="space-y-2">
                  <p className="font-medium">No valid CSV files found.</p>
                  <p>Please check that your files:</p>
                  <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                    <li>Have a header row with column names (e.g., Date, Symbol, Quantity, Price)</li>
                    <li>Contain at least one data row</li>
                    <li>Are properly formatted CSV files (comma-separated values)</li>
                    <li>Are not empty or corrupted</li>
                  </ul>
                  <p className="text-sm mt-2">Check the browser console for detailed error messages.</p>
                </AlertDescription>
              </Alert>
            )}

            {availableColumns.length > 0 && (
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-sm font-medium">Column Mapping</h3>
                
                {/* Default Account Selection (for files without account column) */}
                {(!mapping.account || mapping.account === "__none__") && (
                  <div>
                    <label className="text-sm font-medium">Default Account (if CSV doesn't have account column)</label>
                    <p className="text-xs text-muted-foreground mb-2">
                      If your CSV files don't have an account column, select a default account for all transactions. 
                      The system will also try to extract the account name from the filename (e.g., "RRSP-..." → RRSP).
                    </p>
                    <Select
                      value={defaultAccountId}
                      onValueChange={setDefaultAccountId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select default account (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None - use filename or account column</SelectItem>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Date</label>
                    <Select
                      value={mapping.date || ""}
                      onValueChange={(value) => handleMappingChange("date", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select date column" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableColumns.map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Account</label>
                    <Select
                      value={mapping.account || ""}
                      onValueChange={(value) => handleMappingChange("account", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select account column" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableColumns.map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Symbol</label>
                    <Select
                      value={mapping.symbol || ""}
                      onValueChange={(value) => handleMappingChange("symbol", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select symbol column" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableColumns.map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Type (buy/sell/dividend/etc)</label>
                    <Select
                      value={mapping.type || "__none__"}
                      onValueChange={(value) => handleMappingChange("type", value === "__none__" ? undefined : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type column (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None (defaults to buy)</SelectItem>
                        {availableColumns.map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Quantity</label>
                    <Select
                      value={mapping.quantity || ""}
                      onValueChange={(value) => handleMappingChange("quantity", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select quantity column" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableColumns.map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Price</label>
                    <Select
                      value={mapping.price || ""}
                      onValueChange={(value) => handleMappingChange("price", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select price column" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableColumns.map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Fees (optional)</label>
                    <Select
                      value={mapping.fees || "__none__"}
                      onValueChange={(value) => handleMappingChange("fees", value === "__none__" ? undefined : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select fees column (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {availableColumns.map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Amount (for dividends/transfers)</label>
                    <Select
                      value={mapping.amount || "__none__"}
                      onValueChange={(value) => handleMappingChange("amount", value === "__none__" ? undefined : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select amount column (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {availableColumns.map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Account Mapping */}
            {mapping.account && firstFileData && firstFileData.uniqueAccountNames.length > 0 && (
              <div className="space-y-2 border-t pt-4">
                <h3 className="text-sm font-medium">Map CSV Accounts to Your Accounts</h3>
                {firstFileData.uniqueAccountNames.map((csvAccountName) => {
                  const matchedAccount = accounts.find(
                    (a) => a.name.toLowerCase() === csvAccountName.toLowerCase()
                  );
                  return (
                    <div key={csvAccountName} className="flex items-center gap-2">
                      <span className="text-sm flex-1">{csvAccountName}</span>
                      <span className="text-sm text-muted-foreground">→</span>
                      <Select
                        value={accountMapping[csvAccountName] || matchedAccount?.id || ""}
                        onValueChange={(value) => {
                          setAccountMapping({ ...accountMapping, [csvAccountName]: value });
                        }}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            )}

            {importErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="max-h-40 overflow-y-auto">
                    <p className="font-medium mb-2">Errors ({importErrors.length}):</p>
                    <ul className="list-disc list-inside text-xs space-y-1">
                      {importErrors.slice(0, 10).map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                      {importErrors.length > 10 && (
                        <li>... and {importErrors.length - 10} more errors</li>
                      )}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {importSuccess && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Successfully imported {importSuccess.imported} transactions.
                  {importSuccess.errors > 0 && ` ${importSuccess.errors} errors occurred.`}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div className="border-t px-6 py-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleImport}
              disabled={isImporting || !hasValidFiles || !hasCsvAccess}
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import {files.length} {files.length === 1 ? "File" : "Files"}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

