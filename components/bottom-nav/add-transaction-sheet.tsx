"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Camera, Upload, Plus } from "lucide-react";
import { ReceiptScanner } from "@/components/receipt-scanner/receipt-scanner";
import { TransactionForm } from "@/components/forms/transaction-form";
import { useSubscriptionSafe } from "@/contexts/subscription-context";
import { useBreakpoint } from "@/hooks/use-breakpoint";

interface AddTransactionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddTransactionSheet({
  open,
  onOpenChange,
}: AddTransactionSheetProps) {
  const { limits } = useSubscriptionSafe();
  const breakpoint = useBreakpoint();
  const [isReceiptScannerOpen, setIsReceiptScannerOpen] = React.useState(false);
  const [receiptScannerMode, setReceiptScannerMode] = React.useState<"camera" | "upload" | null>(null);
  const [isTransactionFormOpen, setIsTransactionFormOpen] = React.useState(false);
  
  // Check if receipt scanner feature is enabled via subscription
  const hasReceiptScannerSubscription = limits.hasReceiptScanner === true || String(limits.hasReceiptScanner) === "true";
  
  // Detect if device is mobile/tablet
  const isMobileOrTablet = React.useMemo(() => {
    // Check breakpoint first
    if (breakpoint && (breakpoint === "xs" || breakpoint === "sm" || breakpoint === "md")) {
      return true;
    }
    // Fallback: check for touch device
    if (typeof window !== "undefined") {
      const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      return hasTouch || isMobileUA;
    }
    return false;
  }, [breakpoint]);
  
  // Always show receipt scanner on mobile, or if subscription allows it
  const showReceiptScanner = isMobileOrTablet || hasReceiptScannerSubscription;

  const handleTakePicture = () => {
    setReceiptScannerMode("camera");
    setIsReceiptScannerOpen(true);
    onOpenChange(false);
  };

  const handleUploadReceipt = () => {
    setReceiptScannerMode("upload");
    setIsReceiptScannerOpen(true);
    onOpenChange(false);
  };

  const handleAddNewTransaction = () => {
    setIsTransactionFormOpen(true);
    onOpenChange(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-[20px] p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <SheetTitle>Add Transaction</SheetTitle>
          </SheetHeader>
          <div className="px-6 py-4">
            <div className={showReceiptScanner ? "grid grid-cols-3 gap-3" : "grid grid-cols-1 gap-3"}>
              {showReceiptScanner && (
                <>
                  <Button
                    onClick={handleTakePicture}
                    variant="outline"
                    className="w-full h-auto p-4 flex flex-col items-center gap-2"
                    size="medium"
                  >
                    <div className="p-2 rounded-lg bg-muted">
                      <Camera className="h-5 w-5" />
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-xs">Take a Picture</div>
                      <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                        Scan receipt
                      </div>
                    </div>
                  </Button>
                  <Button
                    onClick={handleUploadReceipt}
                    variant="outline"
                    className="w-full h-auto p-4 flex flex-col items-center gap-2"
                    size="medium"
                  >
                    <div className="p-2 rounded-lg bg-muted">
                      <Upload className="h-5 w-5" />
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-xs">Upload Receipt</div>
                      <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                        Upload image
                      </div>
                    </div>
                  </Button>
                </>
              )}
              <Button
                onClick={handleAddNewTransaction}
                variant="outline"
                className="w-full h-auto p-4 flex flex-col items-center gap-2"
                size="medium"
              >
                <div className="p-2 rounded-lg bg-muted">
                  <Plus className="h-5 w-5" />
                </div>
                <div className="text-center">
                  <div className="font-semibold text-xs">Add New</div>
                  <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                    Manual entry
                  </div>
                </div>
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Receipt Scanner */}
      <ReceiptScanner
        open={isReceiptScannerOpen}
        onOpenChange={(open) => {
          setIsReceiptScannerOpen(open);
          if (!open) {
            setReceiptScannerMode(null);
          }
        }}
        onScanComplete={(data) => {
          // Open transaction form with pre-filled data
          setIsTransactionFormOpen(true);
          setIsReceiptScannerOpen(false);
          setReceiptScannerMode(null);
          // Store receipt data to pre-fill form
          (window as any).__receiptData = data;
        }}
        initialMode={receiptScannerMode}
      />

      {/* Transaction Form */}
      <TransactionForm
        open={isTransactionFormOpen}
        onOpenChange={(open) => {
          setIsTransactionFormOpen(open);
          if (!open) {
            delete (window as any).__receiptData;
          }
        }}
        onSuccess={() => {
          setIsTransactionFormOpen(false);
          delete (window as any).__receiptData;
        }}
      />
    </>
  );
}

