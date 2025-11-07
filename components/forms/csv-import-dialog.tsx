"use client";

import { useState } from "react";
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
import { parseCSV, mapCSVToTransactions, ColumnMapping, CSVRow } from "@/lib/csv/import";
import { usePlanLimits } from "@/hooks/use-plan-limits";
import { UpgradePrompt } from "@/components/billing/upgrade-prompt";

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

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  accounts: Account[];
  categories: Category[];
}

export function CsvImportDialog({
  open,
  onOpenChange,
  onSuccess,
  accounts,
  categories,
}: CsvImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [csvRows, setCsvRows] = useState<CSVRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const { limits, loading: limitsLoading } = usePlanLimits();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    try {
      const rows = await parseCSV(selectedFile);
      setCsvRows(rows);
      if (rows.length > 0) {
        setAvailableColumns(Object.keys(rows[0]));
      }
    } catch (error) {
      console.error("Error parsing CSV:", error);
    }
  };

  const handleMappingChange = (field: keyof ColumnMapping, column: string) => {
    setMapping({ ...mapping, [field]: column });
  };

  const handleImport = async () => {
    if (!file || csvRows.length === 0) return;

    setIsImporting(true);
    try {
      const transactions = mapCSVToTransactions(csvRows, mapping, accounts, categories);
      
      // Create transactions in batches
      const promises = transactions
        .filter((tx) => tx.accountId && tx.amount)
        .map((tx) =>
          fetch("/api/transactions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(tx),
          })
        );
      
      await Promise.all(promises);

      onSuccess?.();
      onOpenChange(false);
      setFile(null);
      setCsvRows([]);
      setMapping({});
    } catch (error) {
      console.error("Error importing CSV:", error);
    } finally {
      setIsImporting(false);
    }
  };

  // Check if user has access to CSV import/export
  // Note: CSV import doesn't require hasCsvExport, but we show a note about transaction limits
  const hasCsvAccess = limits.hasCsvExport;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Transactions from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file and map columns to transaction fields
          </DialogDescription>
        </DialogHeader>

        {!hasCsvAccess && !limitsLoading && (
          <div className="mb-4">
            <UpgradePrompt
              feature="CSV Import/Export"
              currentPlan="free"
              requiredPlan="basic"
              message="CSV import and export are not available in the Free plan. Upgrade to Basic or Premium to import and export your transactions."
            />
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">CSV File</label>
            <Input type="file" accept=".csv" onChange={handleFileChange} />
          </div>

          {availableColumns.length > 0 && (
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

              {csvRows.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  Found {csvRows.length} rows
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={isImporting || !mapping.date || !mapping.amount || (!hasCsvAccess && !limitsLoading)}
          >
            {isImporting ? "Importing..." : "Import"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

