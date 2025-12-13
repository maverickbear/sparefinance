"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

interface PlaidImportLoadingModalProps {
  open: boolean;
  institutionName?: string;
  accountCount?: number;
  stage: "exchanging" | "syncing" | "complete";
  onComplete?: () => void;
}

export function PlaidImportLoadingModal({
  open,
  institutionName = "your bank",
  accountCount = 0,
  stage,
  onComplete,
}: PlaidImportLoadingModalProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!open) {
      setProgress(0);
      return;
    }

    // Simulate progress based on stage
    let targetProgress = 0;
    if (stage === "exchanging") {
      targetProgress = 33;
    } else if (stage === "syncing") {
      targetProgress = 66;
    } else if (stage === "complete") {
      targetProgress = 100;
    }

    // Animate progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= targetProgress) {
          clearInterval(interval);
          return targetProgress;
        }
        return Math.min(prev + 2, targetProgress);
      });
    }, 50);

    return () => clearInterval(interval);
  }, [open, stage]);

  useEffect(() => {
    if (stage === "complete" && progress >= 100) {
      // Wait a bit before calling onComplete
      const timer = setTimeout(() => {
        onComplete?.();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [stage, progress, onComplete]);

  const getStageMessage = () => {
    switch (stage) {
      case "exchanging":
        return "Connecting your account(s)...";
      case "syncing":
        return `Importing transactions from ${accountCount} account(s)...`;
      case "complete":
        return "Import complete!";
      default:
        return "Processing...";
    }
  };

  const getStageDescription = () => {
    switch (stage) {
      case "exchanging":
        return `Securely connecting ${accountCount || 0} account(s) to Spare Finance.`;
      case "syncing":
        return "Fetching and importing your transaction history. This may take a moment.";
      case "complete":
        return "Your accounts and transactions have been successfully imported.";
      default:
        return "Please wait...";
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="relative w-16 h-16">
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl">
            {getStageMessage()}
          </DialogTitle>
          <DialogDescription className="text-center mt-2">
            {getStageDescription()}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 space-y-2">
          {/* Progress bar */}
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300 ease-out rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Progress indicators */}
          <div className="flex items-center justify-center gap-2 mt-4">
            <div
              className={`h-2 w-2 rounded-full transition-all ${
                progress >= 33 ? "bg-primary" : "bg-muted"
              }`}
            />
            <div
              className={`h-2 w-2 rounded-full transition-all ${
                progress >= 66 ? "bg-primary" : "bg-muted"
              }`}
            />
            <div
              className={`h-2 w-2 rounded-full transition-all ${
                progress >= 100 ? "bg-primary" : "bg-muted"
              }`}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

