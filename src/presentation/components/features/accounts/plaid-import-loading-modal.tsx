"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, CheckCircle2, Shield, Database } from "lucide-react";

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
      }, 800);
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

  const getStageIcon = () => {
    switch (stage) {
      case "exchanging":
        return <Shield className="h-6 w-6" />;
      case "syncing":
        return <Database className="h-6 w-6" />;
      case "complete":
        return <CheckCircle2 className="h-6 w-6" />;
      default:
        return <Loader2 className="h-6 w-6 animate-spin" />;
    }
  };

  const isComplete = stage === "complete";

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        {/* Header with gradient background */}
        <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-background px-6 pt-8 pb-6">
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]" />
          
          <DialogHeader className="relative space-y-6">
            {/* Icon container with animated background */}
            <div className="flex items-center justify-center">
              <div className="relative">
                {/* Pulsing background circle */}
                {!isComplete && (
                  <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                )}
                <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 backdrop-blur-sm border border-primary/20 shadow-lg">
                  {isComplete ? (
                    <div className="text-primary scale-110 transition-transform duration-500">
                      {getStageIcon()}
                    </div>
                  ) : (
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  )}
                </div>
              </div>
            </div>

            {/* Title */}
            <DialogTitle className="text-center text-2xl font-semibold tracking-tight text-foreground">
              {getStageMessage()}
            </DialogTitle>

            {/* Description */}
            <DialogDescription className="text-center text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
              {getStageDescription()}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Content section */}
        <div className="px-6 pb-8 pt-6 space-y-6">
          {/* Progress bar with enhanced styling */}
          <div className="space-y-4">
            <div className="relative w-full h-2.5 bg-muted/50 rounded-full overflow-hidden shadow-inner">
              <div
                className="absolute inset-y-0 left-0 h-full bg-gradient-to-r from-primary via-primary to-primary/80 rounded-full transition-all duration-500 ease-out shadow-sm"
                style={{ width: `${progress}%` }}
              >
                {/* Shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
              </div>
            </div>

            {/* Progress indicators with labels */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col items-center gap-2 flex-1">
                <div
                  className={`relative flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 ${
                    progress >= 33
                      ? "bg-primary border-primary text-primary-foreground shadow-md scale-110"
                      : "bg-background border-muted text-muted-foreground"
                  }`}
                >
                  {progress >= 33 ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Shield className="h-4 w-4" />
                  )}
                </div>
                <span className="text-xs font-medium text-muted-foreground text-center">
                  Connect
                </span>
              </div>

              <div className="flex-1 h-0.5 mx-2 bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: progress >= 33 ? "100%" : "0%" }}
                />
              </div>

              <div className="flex flex-col items-center gap-2 flex-1">
                <div
                  className={`relative flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 ${
                    progress >= 66
                      ? "bg-primary border-primary text-primary-foreground shadow-md scale-110"
                      : "bg-background border-muted text-muted-foreground"
                  }`}
                >
                  {progress >= 66 ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Database className="h-4 w-4" />
                  )}
                </div>
                <span className="text-xs font-medium text-muted-foreground text-center">
                  Sync
                </span>
              </div>

              <div className="flex-1 h-0.5 mx-2 bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: progress >= 66 ? "100%" : "0%" }}
                />
              </div>

              <div className="flex flex-col items-center gap-2 flex-1">
                <div
                  className={`relative flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 ${
                    progress >= 100
                      ? "bg-primary border-primary text-primary-foreground shadow-md scale-110"
                      : "bg-background border-muted text-muted-foreground"
                  }`}
                >
                  {progress >= 100 ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <div className="h-4 w-4 rounded-full bg-muted" />
                  )}
                </div>
                <span className="text-xs font-medium text-muted-foreground text-center">
                  Complete
                </span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

