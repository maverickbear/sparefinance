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
import { parseCSV, parseCSVs, mapCSVToTransactions, ColumnMapping, CSVRow, extractUniqueAccountNames, AccountMapping } from "@/lib/csv/import";
import { useSubscription } from "@/hooks/use-subscription";
import { UpgradePrompt } from "@/components/billing/upgrade-prompt";
import { Loader2, AlertCircle, CheckCircle2, X, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Account {
  id: string;
  name: string;
  type: string;
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

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  accounts: Account[];
  categories: Category[];
}

interface FileData {
  file: File;
  rows: CSVRow[];
  availableColumns: string[];
  uniqueAccountNames: string[];
}

export function CsvImportDialog({
  open,
  onOpenChange,
  onSuccess,
  accounts,
  categories,
}: CsvImportDialogProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [filesData, setFilesData] = useState<Map<number, FileData>>(new Map());
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [accountMapping, setAccountMapping] = useState<AccountMapping>({});
  const [defaultAccountId, setDefaultAccountId] = useState<string>("");
  const [uniqueAccountNames, setUniqueAccountNames] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importSuccess, setImportSuccess] = useState<{ success: number; errors: number } | null>(null);
  const { limits, checking: limitsLoading } = useSubscription();
  const { toast } = useToast();

  // Helper function to format account type for display
  function formatAccountType(type: string): string {
    const typeMap: Record<string, string> = {
      checking: "Checking",
      savings: "Savings",
      credit: "Credit Card",
      cash: "Cash",
      investment: "Investment",
      other: "Other",
    };
    return typeMap[type.toLowerCase()] || type;
  }

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setFiles([]);
      setFilesData(new Map());
      setMapping({});
      setAccountMapping({});
      setDefaultAccountId("");
      setImportErrors([]);
      setImportSuccess(null);
    }
  }, [open]);

  const handleFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    setFiles(selectedFiles);
    setAccountMapping({});
    setImportErrors([]);
    setImportSuccess(null);

    try {
      const parsedFiles = await parseCSVs(selectedFiles);
      const newFilesData = new Map<number, FileData>();
      const parseErrors: string[] = [];

      for (let i = 0; i < selectedFiles.length; i++) {
        const rows = parsedFiles.get(i) || [];
        
        if (rows.length > 0) {
          const availableColumns = Object.keys(rows[0]);
          
          // Filter out empty column names
          const validColumns = availableColumns.filter(col => col && col.trim().length > 0);
          if (validColumns.length === 0) {
            parseErrors.push(`${selectedFiles[i].name}: No valid column names found`);
            continue;
          }
          
          // Extract unique account names if account column is mapped
          let uniqueAccountNames: string[] = [];
          if (mapping.account) {
            uniqueAccountNames = extractUniqueAccountNames(rows, mapping.account);
          }

          newFilesData.set(i, {
            file: selectedFiles[i],
            rows,
            availableColumns: validColumns,
            uniqueAccountNames,
          });
        } else {
          parseErrors.push(`${selectedFiles[i].name}: No rows found or file is empty`);
        }
      }

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

      // Auto-detect common column names from first file
      if (newFilesData.size > 0) {
        const firstFileData = Array.from(newFilesData.values())[0];
        const columns = firstFileData.availableColumns;
        const autoMapping: ColumnMapping = { ...mapping };

        columns.forEach((col) => {
          const colLower = col.toLowerCase();
          if (!autoMapping.date && (colLower === "date" || colLower.includes("date") || colLower.includes("data"))) {
            autoMapping.date = col;
          }
          if (!autoMapping.amount && (colLower === "amount" || colLower.includes("amount") || colLower.includes("valor") || colLower.includes("total"))) {
            autoMapping.amount = col;
          }
          if (!autoMapping.description && (colLower === "description" || colLower.includes("description") || colLower.includes("descrição") || colLower.includes("note"))) {
            autoMapping.description = col;
          }
          if (!autoMapping.account && (colLower === "account" || colLower.includes("account") || colLower.includes("conta"))) {
            autoMapping.account = col;
          }
          if (!autoMapping.category && (colLower === "category" || colLower.includes("category") || colLower.includes("categoria"))) {
            autoMapping.category = col;
          }
          if (!autoMapping.type && (colLower === "type" || colLower.includes("type") || colLower.includes("tipo"))) {
            autoMapping.type = col;
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
  
  // Update unique account names when mapping.account or mapping.toAccount changes
  useEffect(() => {
    if ((mapping.account || mapping.toAccount) && filesData.size > 0) {
      const allAccountNames = new Set<string>();
      
      // Extract from all files
      filesData.forEach((fileData) => {
        // Extract from account column
        if (mapping.account) {
          const accountNames = extractUniqueAccountNames(fileData.rows, mapping.account);
          accountNames.forEach(name => allAccountNames.add(name));
        }
        
        // Extract from toAccount column
        if (mapping.toAccount) {
          const toAccountNames = extractUniqueAccountNames(fileData.rows, mapping.toAccount);
          toAccountNames.forEach(name => allAccountNames.add(name));
        }
      });
      
      const uniqueNames = Array.from(allAccountNames).sort();
      setUniqueAccountNames(uniqueNames);
      
      // Auto-map accounts that match exactly (case-insensitive)
      // Only update mappings that don't exist yet to preserve user selections
      setAccountMapping((prevMapping) => {
        const autoMapping: AccountMapping = { ...prevMapping };
        uniqueNames.forEach((csvName) => {
          // Only auto-map if not already mapped
          if (!autoMapping[csvName]) {
            const matchedAccount = accounts.find(
              (a) => a.name.toLowerCase() === csvName.toLowerCase()
            );
            if (matchedAccount) {
              autoMapping[csvName] = matchedAccount.id;
            }
          }
        });
        return autoMapping;
      });
    } else {
      setUniqueAccountNames([]);
    }
  }, [mapping.account, mapping.toAccount, filesData, accounts]);

  // Update filesData when mapping changes
  useEffect(() => {
    if (mapping.account && filesData.size > 0) {
      const newFilesData = new Map(filesData);
      filesData.forEach((fileData, index) => {
        if (mapping.account && fileData.rows.length > 0) {
          const uniqueAccountNames = extractUniqueAccountNames(fileData.rows, mapping.account);
          newFilesData.set(index, { ...fileData, uniqueAccountNames });
        }
      });
      setFilesData(newFilesData);
    }
  }, [mapping.account]);

  const handleMappingChange = (field: keyof ColumnMapping, column: string) => {
    // Convert "__none__" placeholder back to empty string
    const value = column === "__none__" ? "" : column;
    setMapping({ ...mapping, [field]: value });
  };

  const handleImport = async () => {
    if (files.length === 0 || filesData.size === 0) return;

    setIsImporting(true);
    setImportErrors([]);
    setImportSuccess(null);
    
    try {
      // Collect all transactions from all files
      const allTransactions: any[] = [];
      const allErrors: string[] = [];

      filesData.forEach((fileData, fileIndex) => {
        const mapResults = mapCSVToTransactions(
          fileData.rows,
          mapping,
          accounts,
          categories,
          accountMapping,
          defaultAccountId && defaultAccountId !== "__none__" ? defaultAccountId : undefined
        );

        mapResults.forEach((result) => {
          if (result.error) {
            const errorMsg = `File: ${fileData.file.name}, Row ${result.rowIndex}: ${result.error}`;
            allErrors.push(errorMsg);
          } else if (result.transaction) {
            allTransactions.push({
              ...result.transaction,
              rowIndex: result.rowIndex,
              fileName: fileData.file.name,
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
      
      // Import all transactions via batch API
      const response = await fetch("/api/transactions/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          transactions: allTransactions.map(tx => ({
            ...tx,
            date: tx.date instanceof Date ? tx.date.toISOString() : tx.date,
          }))
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      const successCount = result.imported || 0;
      const errorCount = result.errors || 0;
      
      // Format API errors
      const apiErrors: string[] = [];
      if (result.errorDetails && Array.isArray(result.errorDetails)) {
        result.errorDetails.forEach((errorDetail: any) => {
          apiErrors.push(`File: ${errorDetail.fileName || "Unknown"}, Row ${errorDetail.rowIndex}: ${errorDetail.error}`);
        });
      }
      
      // Combine mapping errors with API errors
      const allErrorsCombined = [...allErrors, ...apiErrors];
      setImportErrors(allErrorsCombined);
      setImportSuccess({ success: successCount, errors: errorCount + allErrors.length });
      
      if (successCount > 0) {
        toast({
          title: "Import completed",
          description: `Successfully imported ${successCount} transaction${successCount !== 1 ? "s" : ""}${errorCount > 0 || allErrors.length > 0 ? `. ${errorCount + allErrors.length} failed.` : "."}`,
          variant: errorCount > 0 || allErrors.length > 0 ? "default" : "default",
        });
        onSuccess?.();
      } else {
        toast({
          title: "Import failed",
          description: "No transactions were imported. Please check the errors below.",
          variant: "destructive",
        });
      }
      
      // Only close if all succeeded
      if (errorCount === 0 && allErrors.length === 0) {
        setTimeout(() => {
          onOpenChange(false);
        }, 2000);
      }
    } catch (error) {
      console.error("Error importing CSV:", error);
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  // Check if user has access to CSV import
  // The database is the source of truth - if a feature is disabled in Supabase, it should be disabled here
  // Safety check: convert string "true" to boolean (defensive programming)
  const hasCsvAccess = limits.hasCsvImport === true || String(limits.hasCsvImport) === "true";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl sm:max-h-[90vh] flex flex-col !p-0 !gap-0">
        <DialogHeader>
          <DialogTitle>Import Transactions from CSV</DialogTitle>
          <DialogDescription>
            Upload one or more CSV files and map columns to transaction fields
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
                  message="CSV import is not available. Please upgrade to Essential or Pro to import your transactions."
                />
              </div>
            )}
          <div>
            <label className="text-sm font-medium">CSV Files</label>
            <Input type="file" accept=".csv" multiple onChange={handleFilesChange} />
            {files.length > 0 && (
              <div className="mt-2 space-y-2">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm flex-1">{file.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => {
                        const newFiles = files.filter((_, i) => i !== index);
                        setFiles(newFiles);
                        // Reindex filesData - keep data for files that remain
                        const reindexed = new Map<number, FileData>();
                        newFiles.forEach((f, newIndex) => {
                          const oldIndex = files.findIndex(oldF => oldF === f);
                          if (oldIndex !== -1 && filesData.has(oldIndex)) {
                            reindexed.set(newIndex, filesData.get(oldIndex)!);
                          }
                        });
                        setFilesData(reindexed);
                        // Clear account mapping if no files remain
                        if (newFiles.length === 0) {
                          setAccountMapping({});
                          setUniqueAccountNames([]);
                        }
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {filesData.size > 0 && (
            <div className="space-y-1">
              <label className="text-sm font-medium">Default Account</label>
              <Select
                value={defaultAccountId}
                onValueChange={setDefaultAccountId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account for all transactions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None (account must be in CSV)</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{account.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {formatAccountType(account.type)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select an account to use for all transactions if the CSV doesn't have an account column or account is not found.
              </p>
            </div>
          )}

          {filesData.size > 0 && (() => {
            // Combine columns from all files
            const allColumns = new Set<string>();
            filesData.forEach((fileData) => {
              fileData.availableColumns.forEach(col => allColumns.add(col));
            });
            const availableColumns = Array.from(allColumns).sort();
            
            return availableColumns.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Column Mapping</h3>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Date</label>
                  <Select
                    value={mapping.date || ""}
                    onValueChange={(value) => handleMappingChange("date", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column" />
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

                <div className="space-y-1">
                  <label className="text-sm font-medium">Amount</label>
                  <Select
                    value={mapping.amount || ""}
                    onValueChange={(value) => handleMappingChange("amount", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column" />
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

                <div className="space-y-1">
                  <label className="text-sm font-medium">Description</label>
                  <Select
                    value={mapping.description || ""}
                    onValueChange={(value) => handleMappingChange("description", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column" />
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

                <div className="space-y-1">
                  <label className="text-sm font-medium">Account</label>
                  <Select
                    value={mapping.account || ""}
                    onValueChange={(value) => handleMappingChange("account", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column" />
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

                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    To Account <span className="text-muted-foreground text-xs">(for transfers)</span>
                  </label>
                  <Select
                    value={mapping.toAccount || "__none__"}
                    onValueChange={(value) => handleMappingChange("toAccount", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column (optional)" />
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

                <div className="space-y-1">
                  <label className="text-sm font-medium">Category</label>
                  <Select
                    value={mapping.category || ""}
                    onValueChange={(value) => handleMappingChange("category", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column" />
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

                <div className="space-y-1">
                  <label className="text-sm font-medium">Type</label>
                  <Select
                    value={mapping.type || ""}
                    onValueChange={(value) => handleMappingChange("type", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column" />
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
              </div>

              {uniqueAccountNames.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Map CSV Accounts to Your Accounts</h3>
                  <div className="space-y-3">
                    {uniqueAccountNames.map((csvAccountName) => {
                      const currentMapping = accountMapping[csvAccountName];
                      const matchedAccount = accounts.find((a) => a.id === currentMapping);
                      
                      return (
                        <div key={csvAccountName} className="flex items-center gap-3">
                          <div className="flex-1 text-sm">
                            <span className="font-medium">"{csvAccountName}"</span>
                            <span className="text-muted-foreground ml-2">→</span>
                          </div>
                          <Select
                            value={currentMapping || ""}
                            onValueChange={(accountId) => {
                              setAccountMapping({
                                ...accountMapping,
                                [csvAccountName]: accountId,
                              });
                            }}
                          >
                            <SelectTrigger className="w-[200px]">
                              <SelectValue placeholder="Select account" />
                            </SelectTrigger>
                            <SelectContent>
                              {accounts.map((account) => (
                                <SelectItem key={account.id} value={account.id}>
                                  <div className="flex items-center justify-between w-full">
                                    <span>{account.name}</span>
                                    <span className="text-xs text-muted-foreground ml-2">
                                      {formatAccountType(account.type)}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </div>
                  {uniqueAccountNames.some((name) => !accountMapping[name]) && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Please map all CSV account names to your accounts before importing.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {filesData.size > 0 && (
                <div className="text-sm text-muted-foreground">
                  Found {Array.from(filesData.values()).reduce((sum, fd) => sum + fd.rows.length, 0)} rows across {filesData.size} file{filesData.size !== 1 ? 's' : ''}
                </div>
              )}
              
              {importSuccess && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Successfully imported {importSuccess.success} transaction{importSuccess.success !== 1 ? "s" : ""}.
                    {importSuccess.errors > 0 && ` ${importSuccess.errors} error${importSuccess.errors !== 1 ? "s" : ""} occurred.`}
                  </AlertDescription>
                </Alert>
              )}
              
              {importErrors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <div className="font-medium">Errors found:</div>
                      <div className="max-h-32 overflow-y-auto text-sm">
                        {importErrors.slice(0, 10).map((error, idx) => (
                          <div key={idx}>{error}</div>
                        ))}
                        {importErrors.length > 10 && (
                          <div className="text-muted-foreground">
                            ... and {importErrors.length - 10} more error{importErrors.length - 10 !== 1 ? "s" : ""}
                          </div>
                        )}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
            );
          })()}
          </div>

          <div className="px-6 py-4 border-t flex justify-end gap-2 flex-shrink-0">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleImport} 
              disabled={
                isImporting || 
                !mapping.date || 
                !mapping.amount || 
                (!hasCsvAccess && !limitsLoading) ||
                filesData.size === 0 ||
                (uniqueAccountNames.length > 0 && uniqueAccountNames.some((name) => !accountMapping[name])) ||
                (!mapping.account && (!defaultAccountId || defaultAccountId === "__none__"))
              }
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                "Import"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

