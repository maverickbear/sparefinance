"use client";

import { Download, Upload, FileSpreadsheet, CheckCircle2 } from "lucide-react";

export function CsvImportExportMockup() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="w-full max-w-[280px] space-y-3">
        {/* Export Card */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-sentiment-positive/10 flex items-center justify-center">
              <Download className="w-5 h-5 text-sentiment-positive" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Export to CSV</p>
              <p className="text-xs text-muted-foreground">Download your data</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileSpreadsheet className="w-4 h-4" />
            <span>transactions_2024.csv</span>
          </div>
        </div>

        {/* Import Card */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-interactive-primary/10 flex items-center justify-center">
              <Upload className="w-5 h-5 text-interactive-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Import from CSV</p>
              <p className="text-xs text-muted-foreground">Upload spreadsheet</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-sentiment-positive">
            <CheckCircle2 className="w-4 h-4" />
            <span>125 transactions imported</span>
          </div>
        </div>
      </div>
    </div>
  );
}

