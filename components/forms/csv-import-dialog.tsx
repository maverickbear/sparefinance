"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  parseCSV, 
  parseCSVs, 
  mapCSVToTransactions, 
  ColumnMapping, 
  CSVRow, 
  extractUniqueAccountNames, 
  AccountMapping,
  TransactionTypeMapping,
  extractUniqueTransactionTypes
} from "@/lib/csv/import";
import { useSubscription } from "@/hooks/use-subscription";
import { Loader2, AlertCircle, CheckCircle2, X, FileText, ArrowRight, Info, Upload, Sparkles } from "lucide-react";
import {
  batchSuggest,
  getSuggestion,
  saveLearnedMapping,
  type TransactionType,
} from "@/lib/csv/transaction-type-suggester";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ImportProgress } from "@/src/presentation/components/features/accounts/import-progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

// Field definitions for mapping
interface FieldDefinition {
  key: keyof ColumnMapping;
  label: string;
  required: boolean;
  description: string;
  icon?: string;
}

const TRANSACTION_FIELDS: FieldDefinition[] = [
  {
    key: "date",
    label: "Date",
    required: true,
    description: "Transaction date (required)",
    icon: "📅",
  },
  {
    key: "amount",
    label: "Amount",
    required: true,
    description: "Transaction amount (required)",
    icon: "💰",
  },
  {
    key: "description",
    label: "Description",
    required: false,
    description: "Transaction description",
    icon: "📝",
  },
  {
    key: "type",
    label: "Transaction Type",
    required: true,
    description: "Transaction type column (will be mapped individually)",
    icon: "🔄",
  },
  {
    key: "toAccount",
    label: "To Account",
    required: false,
    description: "Destination account for transfer transactions (optional)",
    icon: "➡️",
  },
];

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
  const [transactionTypeMapping, setTransactionTypeMapping] = useState<TransactionTypeMapping>({});
  const [defaultAccountId, setDefaultAccountId] = useState<string>("");
  const [uniqueAccountNames, setUniqueAccountNames] = useState<string[]>([]);
  const [uniqueTransactionTypes, setUniqueTransactionTypes] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importJobId, setImportJobId] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importSuccess, setImportSuccess] = useState<{ success: number; errors: number } | null>(null);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isAILoading, setIsAILoading] = useState(false);
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

  // Get all available columns from all files (moved before useEffect that uses it)
  const availableColumns = useMemo(() => {
    const allColumns = new Set<string>();
    filesData.forEach((fileData) => {
      fileData.availableColumns.forEach(col => allColumns.add(col));
    });
    return Array.from(allColumns).sort();
  }, [filesData]);

  // Get sample data for a column (first 3 non-empty values)
  const getColumnSamples = (columnName: string, maxSamples: number = 3): string[] => {
    const samples: string[] = [];
    filesData.forEach((fileData) => {
      for (const row of fileData.rows) {
        const value = row[columnName];
        if (value && value.trim() && !samples.includes(value.trim()) && samples.length < maxSamples) {
          samples.push(value.trim());
        }
      }
    });
    return samples;
  };

  // Generate preview of mapped transactions
  useEffect(() => {
    // Use mapping as-is - type will be handled by transactionTypeMapping if column is mapped
    if (filesData.size > 0 && mapping.date && mapping.amount) {
      try {
        const allRows: CSVRow[] = [];
        filesData.forEach((fileData) => {
          allRows.push(...fileData.rows.slice(0, 5)); // Preview first 5 rows
        });

        const mapResults = mapCSVToTransactions(
          allRows,
          mapping,
          accounts,
          categories,
          accountMapping,
          defaultAccountId && defaultAccountId !== "__none__" ? defaultAccountId : undefined,
          Object.keys(transactionTypeMapping).length > 0 ? transactionTypeMapping : undefined
        );

        const preview = mapResults
          .filter((r) => r.transaction)
          .slice(0, 5)
          .map((r) => ({
            ...r.transaction!,
            rowIndex: r.rowIndex,
          }));

        setPreviewRows(preview);
      } catch (error) {
        console.error("Error generating preview:", error);
        setPreviewRows([]);
      }
    } else {
      setPreviewRows([]);
    }
  }, [mapping, accountMapping, transactionTypeMapping, defaultAccountId, filesData, accounts, categories]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setFiles([]);
      setFilesData(new Map());
      setMapping({});
      setAccountMapping({});
      setTransactionTypeMapping({});
      setDefaultAccountId("");
      setUniqueAccountNames([]);
      setUniqueTransactionTypes([]);
      setImportErrors([]);
      setImportSuccess(null);
      setPreviewRows([]);
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

        // Don't set a default type if a CSV column is detected - let user map individually
        // Only set default if no type column is found
        if (!autoMapping.type) {
          // No type column found, but we still need a default for validation
          // User can map a column later
        }

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
  
  // Update unique transaction types when mapping.type changes (and it's a CSV column)
  useEffect(() => {
    if (mapping.type && availableColumns.includes(mapping.type) && filesData.size > 0) {
      const allTypeValues = new Set<string>();
      
      // Extract from all files
      filesData.forEach((fileData) => {
        const typeValues = extractUniqueTransactionTypes(fileData.rows, mapping.type!);
        typeValues.forEach(value => allTypeValues.add(value));
      });
      
      const uniqueTypes = Array.from(allTypeValues).sort();
      setUniqueTransactionTypes(uniqueTypes);
      
      // Clear mappings for values that no longer exist
      setTransactionTypeMapping((prevMapping) => {
        const newMapping: TransactionTypeMapping = {};
        Object.keys(prevMapping).forEach((csvValue) => {
          if (uniqueTypes.includes(csvValue)) {
            newMapping[csvValue] = prevMapping[csvValue];
          }
        });
        return newMapping;
      });

      // Auto-suggest based on learned patterns and pattern matching
      const suggestions = batchSuggest(uniqueTypes);
      if (Object.keys(suggestions).length > 0) {
        setTransactionTypeMapping((prevMapping) => {
          const updated = { ...prevMapping };
          Object.entries(suggestions).forEach(([value, type]) => {
            // Only auto-suggest if not already mapped
            if (!updated[value]) {
              updated[value] = type;
            }
          });
          return updated;
        });
      }
    } else {
      setUniqueTransactionTypes([]);
      setTransactionTypeMapping({});
    }
  }, [mapping.type, filesData, availableColumns]);

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

  // Save learned mapping when user manually selects a type
  const handleTransactionTypeChange = (csvValue: string, type: TransactionType) => {
    setTransactionTypeMapping({
      ...transactionTypeMapping,
      [csvValue]: type,
    });
    // Save to learned mappings
    saveLearnedMapping(csvValue, type);
  };

  // Auto-fill with AI
  const handleAIAutoFill = async () => {
    if (uniqueTransactionTypes.length === 0) return;

    setIsAILoading(true);
    try {
      const response = await fetch("/api/v2/transactions/suggest-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: uniqueTransactionTypes }),
      });

      if (!response.ok) {
        throw new Error("Failed to get AI suggestions");
      }

      const data = await response.json();
      const suggestions = data.suggestions || {};

      // Update mappings with AI suggestions
      setTransactionTypeMapping((prevMapping) => {
        const updated = { ...prevMapping };
        Object.entries(suggestions).forEach(([value, type]) => {
          updated[value] = type as TransactionType;
          // Save to learned mappings
          saveLearnedMapping(value, type as TransactionType);
        });
        return updated;
      });

      toast({
        title: "Auto-filled with AI",
        description: `Mapped ${Object.keys(suggestions).length} transaction type${Object.keys(suggestions).length !== 1 ? "s" : ""}`,
        variant: "default",
      });
    } catch (error) {
      console.error("Error getting AI suggestions:", error);
      toast({
        title: "AI suggestion failed",
        description: error instanceof Error ? error.message : "Failed to get AI suggestions. Using pattern matching instead.",
        variant: "destructive",
      });
    } finally {
      setIsAILoading(false);
    }
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
          defaultAccountId && defaultAccountId !== "__none__" ? defaultAccountId : undefined,
          Object.keys(transactionTypeMapping).length > 0 ? transactionTypeMapping : undefined
        );

        mapResults.forEach((result) => {
          if (result.error) {
            const errorMsg = `File: ${fileData.file.name}, Row ${result.rowIndex}: ${result.error}`;
            allErrors.push(errorMsg);
          } else if (result.transaction) {
            // Validate accountId exists in accounts list before adding
            const accountExists = accounts.some(a => a.id === result.transaction!.accountId);
            if (!accountExists) {
              const errorMsg = `File: ${fileData.file.name}, Row ${result.rowIndex}: Account ID "${result.transaction!.accountId}" not found in your accounts. Please check your account mapping.`;
              allErrors.push(errorMsg);
              return;
            }
            
            // Validate transfer transactions (only if toAccountId is provided)
            if (result.transaction.type === "transfer" && result.transaction.toAccountId) {
              // Validate toAccountId exists
              const toAccountExists = accounts.some(a => a.id === result.transaction!.toAccountId);
              if (!toAccountExists) {
                const errorMsg = `File: ${fileData.file.name}, Row ${result.rowIndex}: Destination account ID "${result.transaction!.toAccountId}" not found in your accounts. Please check your account mapping.`;
                allErrors.push(errorMsg);
                return;
              }
              
              // Validate source and destination are different
              if (result.transaction.accountId === result.transaction.toAccountId) {
                const errorMsg = `File: ${fileData.file.name}, Row ${result.rowIndex}: Transfer requires different source and destination accounts.`;
                allErrors.push(errorMsg);
                return;
              }
            }
            
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
      
      // Final validation: ensure all accountIds are valid before sending
      const invalidAccountIds = new Set<string>();
      allTransactions.forEach((tx) => {
        if (!accounts.some(a => a.id === tx.accountId)) {
          invalidAccountIds.add(tx.accountId);
        }
        if (tx.toAccountId && !accounts.some(a => a.id === tx.toAccountId)) {
          invalidAccountIds.add(tx.toAccountId);
        }
      });

      if (invalidAccountIds.size > 0) {
        const invalidIdsList = Array.from(invalidAccountIds).join(", ");
        const errorMsg = `Invalid account IDs detected: ${invalidIdsList}. Please refresh the page and try again, or check your account mapping.`;
        allErrors.push(errorMsg);
        setImportErrors([...allErrors, errorMsg]);
        toast({
          title: "Validation Error",
          description: errorMsg,
          variant: "destructive",
        });
        setIsImporting(false);
        return;
      }

      // Import all transactions via batch API
      const response = await fetch("/api/v2/transactions/import", {
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
      
      // Check if a job was created (large import)
      if (result.jobId) {
        setImportJobId(result.jobId);
        toast({
          title: "Import queued",
          description: result.message || `Import queued for background processing. ${allTransactions.length} transactions will be imported.`,
          variant: "success",
        });
        // Don't close dialog - show progress
        setIsImporting(false);
        return;
      }
      
      // Small import completed immediately
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
  const hasCsvAccess = limits.hasCsvImport === true || String(limits.hasCsvImport) === "true";

  // Get total row count
  const totalRows = useMemo(() => {
    return Array.from(filesData.values()).reduce((sum, fd) => sum + fd.rows.length, 0);
  }, [filesData]);

  // Check if required fields are mapped
  // Type is required:
  // - If mapping.type is a CSV column, all unique values must be mapped individually
  // - If mapping.type is a direct value (expense/income/transfer), it's valid
  const isTypeColumnMapped = mapping.type && availableColumns.includes(mapping.type);
  const hasTransactionType = mapping.type && (
    ["expense", "income", "transfer"].includes(mapping.type) || 
    (isTypeColumnMapped && (
      uniqueTransactionTypes.length === 0 || 
      uniqueTransactionTypes.every((value) => transactionTypeMapping[value])
    ))
  );
  
  const isMappingValid = mapping.date && mapping.amount && hasTransactionType && (
    mapping.account || (defaultAccountId && defaultAccountId !== "__none__")
  ) && (
    uniqueAccountNames.length === 0 || uniqueAccountNames.every((name) => accountMapping[name])
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col w-full sm:max-w-[640px] p-0 gap-0 overflow-hidden bg-background border-l">
        <SheetHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0 bg-background text-left">
          <SheetTitle className="text-xl font-semibold">Import Transactions from CSV</SheetTitle>
          <SheetDescription className="mt-1.5 text-sm text-muted-foreground">
            Upload your CSV files and map columns to transaction fields
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col flex-1 overflow-hidden bg-muted/30">
          <ScrollArea className="flex-1">
            {importJobId && (
              <div className="px-8 pt-6">
                <ImportProgress
                  jobIds={[importJobId]}
                  onComplete={() => {
                    setImportJobId(null);
                    onSuccess?.();
                    onOpenChange(false);
                  }}
                />
              </div>
            )}
            
            {!hasCsvAccess && !limitsLoading && (
              <div className="px-8 pt-6">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    CSV import is not available in your current plan.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            <div className="px-8 py-6 space-y-8">
              {/* Step 1: Upload Files */}
              <section className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold">1. Upload CSV Files</h3>
                  <p className="text-sm text-muted-foreground">
                    {files.length > 0 
                      ? `${files.length} file${files.length !== 1 ? "s" : ""} uploaded` 
                      : "Drag and drop CSV files or click to browse"}
                  </p>
                </div>
                <div className="space-y-4">
                  {/* Dropzone - only show when no files uploaded */}
                  {files.length === 0 && (
                    <div
                      className={cn(
                        "relative border-2 border-dashed rounded-lg transition-all duration-200",
                        isDragging
                          ? "border-primary bg-primary/5 scale-[1.02]"
                          : "border-border hover:border-primary/50 bg-background",
                        (!hasCsvAccess && !limitsLoading) && "opacity-50 cursor-not-allowed"
                      )}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (hasCsvAccess && !limitsLoading) setIsDragging(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // Check if we're actually leaving the dropzone (not just moving to a child element)
                        const relatedTarget = e.relatedTarget as HTMLElement;
                        if (!e.currentTarget.contains(relatedTarget)) {
                          setIsDragging(false);
                        }
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDragging(false);
                        if (!hasCsvAccess && !limitsLoading) return;
                        const droppedFiles = Array.from(e.dataTransfer.files).filter(
                          (file) => file.name.toLowerCase().endsWith('.csv')
                        );
                        if (droppedFiles.length > 0) {
                          // Create a synthetic event for handleFilesChange
                          const syntheticEvent = {
                            target: {
                              files: droppedFiles,
                            },
                          } as unknown as React.ChangeEvent<HTMLInputElement>;
                          handleFilesChange(syntheticEvent);
                        } else if (e.dataTransfer.files.length > 0) {
                          toast({
                            title: "Invalid file type",
                            description: "Please upload CSV files only",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      <input
                        type="file"
                        accept=".csv"
                        multiple
                        onChange={handleFilesChange}
                        disabled={!hasCsvAccess && !limitsLoading}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        id="csv-file-upload-input"
                      />
                      <div className="flex flex-col items-center justify-center p-12 text-center">
                        <div className={cn(
                          "rounded-full p-4 mb-4 transition-colors",
                          isDragging ? "bg-primary/10" : "bg-muted"
                        )}>
                          <Upload className={cn(
                            "h-8 w-8 transition-colors",
                            isDragging ? "text-primary" : "text-muted-foreground"
                          )} />
                        </div>
                        <p className="text-sm font-medium mb-1">
                          {isDragging ? "Drop CSV files here" : "Drag and drop CSV files here"}
                        </p>
                        <p className="text-xs text-muted-foreground mb-2">
                          or click to browse
                        </p>
                        <p className="text-xs text-muted-foreground">
                          CSV files only • Multiple files supported
                        </p>
                      </div>
                    </div>
                  )}

                  {/* File List - show when files are uploaded */}
                  {files.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Uploaded Files</p>
                        {totalRows > 0 && (
                          <p className="text-xs text-muted-foreground">
                            <strong>{totalRows}</strong> row{totalRows !== 1 ? "s" : ""} across <strong>{files.length}</strong> file{files.length !== 1 ? "s" : ""}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        {files.map((file, index) => (
                          <div key={index} className="flex items-center gap-3 p-3 bg-background border rounded-lg hover:bg-muted/50 transition-colors">
                            <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm flex-1 truncate font-medium">{file.name}</span>
                            <Badge variant="secondary" className="text-xs font-normal">
                              {filesData.get(index)?.rows.length || 0} rows
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const newFiles = files.filter((_, i) => i !== index);
                                setFiles(newFiles);
                                const reindexed = new Map<number, FileData>();
                                newFiles.forEach((f, newIndex) => {
                                  const oldIndex = files.findIndex(oldF => oldF === f);
                                  if (oldIndex !== -1 && filesData.has(oldIndex)) {
                                    reindexed.set(newIndex, filesData.get(oldIndex)!);
                                  }
                                });
                                setFilesData(reindexed);
                                if (newFiles.length === 0) {
                                  setAccountMapping({});
                                  setUniqueAccountNames([]);
                                }
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <Button
                        variant="outline"
                        size="medium"
                        onClick={() => {
                          // Re-show dropzone by clearing files
                          setFiles([]);
                          setFilesData(new Map());
                          setAccountMapping({});
                          setUniqueAccountNames([]);
                          setMapping({});
                          setDefaultAccountId("");
                        }}
                        className="w-full"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload More Files
                      </Button>
                    </div>
                  )}
                </div>
              </section>

              {filesData.size > 0 && (
                <>
                  {/* Step 2: Configuration */}
                  <section className="space-y-4">
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold">2. Configuration</h3>
                      <p className="text-sm text-muted-foreground">Set default values for your transactions</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Default Account */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Default Account</label>
                        <p className="text-xs text-muted-foreground">Used if CSV doesn't have an account column</p>
                        <Select
                          value={defaultAccountId}
                          onValueChange={setDefaultAccountId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select account (optional)" />
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
                      </div>

                    </div>
                  </section>

                  {/* Step 3: Map Columns */}
                  <section className="space-y-4">
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold">3. Map CSV Columns</h3>
                      <p className="text-sm text-muted-foreground">Match CSV columns to transaction fields. Fields marked with * are required.</p>
                    </div>
                    
                    <div className="space-y-5">
                      {/* Mapping Section */}
                      <div className="space-y-5">
                        {/* CSV Columns Found */}
                        <div className="p-4 bg-background border rounded-lg">
                          <div className="flex items-center gap-2 mb-3">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">CSV Columns Found</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {availableColumns.length > 0 ? (
                              availableColumns.map((col) => (
                                <Badge key={col} variant="outline" className="text-xs font-normal">
                                  {col}
                                </Badge>
                              ))
                            ) : (
                              <p className="text-sm text-muted-foreground">No columns detected</p>
                            )}
                          </div>
                        </div>

                        {/* Mapping Table - Clean Layout like the image */}
                        <div className="bg-background border rounded-lg overflow-hidden">
                          {/* Header */}
                          <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] gap-4 px-6 py-4 border-b bg-muted/30">
                            <div className="text-sm font-semibold text-foreground">System Field</div>
                            <div className="w-6"></div>
                            <div className="text-sm font-semibold text-foreground">CSV Column</div>
                            <div className="w-6"></div>
                            <div className="text-sm font-semibold text-foreground">Example</div>
                          </div>
                          
                          {/* Mapping Rows */}
                          <div className="divide-y">
                            {TRANSACTION_FIELDS.map((field) => {
                              const mappedColumn = mapping[field.key];
                              const samples = mappedColumn ? getColumnSamples(mappedColumn, 1) : [];
                              const hasError = !mappedColumn && field.required;
                              const exampleValue = samples.length > 0 ? samples[0] : null;

                              return (
                                <div 
                                  key={field.key} 
                                  className={cn(
                                    "grid grid-cols-[1fr_auto_1fr_auto_1fr] gap-4 px-6 py-4 items-center transition-colors",
                                    hasError && "bg-destructive/5"
                                  )}
                                >
                                  {/* System Field */}
                                  <div className="flex items-center gap-2.5">
                                    {field.required && <span className="text-destructive text-sm font-bold">*</span>}
                                    <span className="text-base">{field.icon}</span>
                                    <label className="text-sm font-medium">
                                      {field.label}
                                    </label>
                                  </div>
                                  
                                  {/* Arrow */}
                                  <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                  
                                  {/* CSV Column Selector */}
                                  <div className="flex items-center gap-2">
                                    <Select
                                      value={mappedColumn || ""}
                                      onValueChange={(value) => handleMappingChange(field.key, value)}
                                    >
                                      <SelectTrigger className={cn(
                                        "flex-1",
                                        hasError && "border-destructive"
                                      )}>
                                        <SelectValue placeholder="-" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="__none__">-</SelectItem>
                                        {availableColumns.map((col) => (
                                          <SelectItem key={col} value={col}>
                                            {col}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    {hasError && (
                                      <div className="h-5 w-5 rounded-full bg-destructive flex items-center justify-center flex-shrink-0">
                                        <span className="text-white text-xs font-bold">!</span>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Equals */}
                                  <span className="text-muted-foreground text-sm">=</span>
                                  
                                  {/* Example */}
                                  <div className="text-sm text-muted-foreground">
                                    {exampleValue || "-"}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Step 4: Map Transaction Types */}
                  {uniqueTransactionTypes.length > 0 && (
                    <section className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <h3 className="text-lg font-semibold">4. Map Transaction Types</h3>
                          <p className="text-sm text-muted-foreground">Match CSV transaction type values to system transaction types</p>
                        </div>
                        <Button
                          variant="outline"
                          size="medium"
                          onClick={handleAIAutoFill}
                          disabled={isAILoading || uniqueTransactionTypes.every((v) => transactionTypeMapping[v])}
                        >
                          {isAILoading ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Analyzing...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4 mr-2" />
                              Auto-fill with AI
                            </>
                          )}
                        </Button>
                      </div>
                      <div className="bg-background border rounded-lg p-5 space-y-4">
                        {uniqueTransactionTypes.map((csvTypeValue) => {
                          const currentMapping = transactionTypeMapping[csvTypeValue];
                          const suggestion = getSuggestion(csvTypeValue);
                          const hasSuggestion = suggestion && !currentMapping;
                          
                          return (
                            <div key={csvTypeValue} className="flex items-center gap-4">
                              <div className="flex items-center gap-2 min-w-[180px]">
                                <Badge variant="outline" className="text-xs font-normal">CSV</Badge>
                                <span className="text-sm font-medium font-mono">"{csvTypeValue}"</span>
                                {hasSuggestion && (
                                  <Badge variant="secondary" className="text-xs">
                                    Suggested: {suggestion}
                                  </Badge>
                                )}
                              </div>
                              <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <Select
                                value={currentMapping || ""}
                                onValueChange={(type) => {
                                  handleTransactionTypeChange(csvTypeValue, type as TransactionType);
                                }}
                              >
                                <SelectTrigger className={cn(
                                  "flex-1 max-w-[300px]",
                                  hasSuggestion && "border-primary/50"
                                )}>
                                  <SelectValue placeholder={hasSuggestion ? `Suggested: ${suggestion}` : "Select transaction type"} />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="expense">Expense</SelectItem>
                                  <SelectItem value="income">Income</SelectItem>
                                  <SelectItem value="transfer">Transfer</SelectItem>
                                </SelectContent>
                              </Select>
                              {currentMapping && (
                                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                              )}
                            </div>
                          );
                        })}
                        {uniqueTransactionTypes.some((value) => !transactionTypeMapping[value]) && (
                          <Alert variant="destructive" className="mt-2">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              Please map all CSV transaction type values before importing.
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </section>
                  )}

                  {/* Step 5: Map Accounts */}
                  {uniqueAccountNames.length > 0 && (
                    <section className="space-y-4">
                      <div className="space-y-1">
                        <h3 className="text-lg font-semibold">{uniqueTransactionTypes.length > 0 ? "5" : "4"}. Map Account Names</h3>
                        <p className="text-sm text-muted-foreground">Match CSV account names to your Spare Finance accounts</p>
                      </div>
                      <div className="bg-background border rounded-lg p-5 space-y-4">
                        {uniqueAccountNames.map((csvAccountName) => {
                          const currentMapping = accountMapping[csvAccountName];
                          const matchedAccount = accounts.find((a) => a.id === currentMapping);
                          
                          return (
                            <div key={csvAccountName} className="flex items-center gap-4">
                              <div className="flex items-center gap-2 min-w-[180px]">
                                <Badge variant="outline" className="text-xs font-normal">CSV</Badge>
                                <span className="text-sm font-medium">"{csvAccountName}"</span>
                              </div>
                              <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <Select
                                value={currentMapping || ""}
                                onValueChange={(accountId) => {
                                  setAccountMapping({
                                    ...accountMapping,
                                    [csvAccountName]: accountId,
                                  });
                                }}
                              >
                                <SelectTrigger className="flex-1 max-w-[300px]">
                                  <SelectValue placeholder="Select account" />
                                </SelectTrigger>
                                <SelectContent>
                                  {accounts.map((account) => (
                                    <SelectItem key={account.id} value={account.id}>
                                      <div className="flex items-center justify-between w-full">
                                        <span>{account.name}</span>
                                        <Badge variant="secondary" className="text-xs ml-2 font-normal">
                                          {formatAccountType(account.type)}
                                        </Badge>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {matchedAccount && (
                                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                              )}
                            </div>
                          );
                        })}
                        {uniqueAccountNames.some((name) => !accountMapping[name]) && (
                          <Alert variant="destructive" className="mt-2">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              Please map all CSV account names before importing.
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </section>
                  )}


                  {/* Success/Error Messages */}
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
                </>
              )}
          </div>
          </ScrollArea>

          <div className="px-6 py-4 border-t bg-background flex justify-end gap-3 flex-shrink-0">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
              Cancel
            </Button>
            <Button 
              onClick={handleImport} 
              disabled={
                isImporting || 
                !isMappingValid ||
                (!hasCsvAccess && !limitsLoading) ||
                filesData.size === 0
              }
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                "Import Transactions"
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
