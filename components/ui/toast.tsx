"use client";

import * as React from "react";
import { X, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "success" | "destructive";
  action?: {
    label: string;
    onClick: () => void;
    countdown?: number; // Countdown in seconds
  };
  onDismiss?: () => void;
  duration?: number; // Auto-close duration in ms (default: 3000)
}

interface ToastProps {
  toast: Toast;
  onClose: (id: string) => void;
}

export function ToastComponent({ toast, onClose }: ToastProps) {
  const { id, title, description, variant = "default", action, onDismiss, duration = 3000 } = toast;
  const [countdown, setCountdown] = React.useState<number | null>(action?.countdown ?? null);

  // Handle countdown for action button
  React.useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    } else if (countdown === 0 && action) {
      // Countdown expired, execute dismiss callback if provided
      // Use a small delay to ensure state is updated
      const timeout = setTimeout(() => {
        if (onDismiss) {
          onDismiss();
        }
        onClose(id);
      }, 100);

      return () => clearTimeout(timeout);
    }
  }, [countdown, action, onDismiss, id, onClose]);

  // Handle auto-close timer
  // If there's an action without countdown, still auto-close after duration
  // If there's an action with countdown, the countdown effect handles the close
  React.useEffect(() => {
    // Auto-close if:
    // 1. No action at all, OR
    // 2. Action exists but countdown is null (no countdown)
    if (!action || (action && countdown === null)) {
      const timer = setTimeout(() => {
        if (onDismiss) {
          onDismiss();
        }
        onClose(id);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [id, onClose, duration, action, countdown, onDismiss]);

  const handleClose = () => {
    if (onDismiss) {
      onDismiss();
    }
    onClose(id);
  };

  const actionLabel = action
    ? countdown !== null && countdown > 0
      ? `${action.label} (${countdown}s)`
      : action.label
    : null;

  return (
    <div className="relative shadow-lg transition-all animate-in slide-in-from-top-5 fade-in-0 duration-300">
      <Alert
        variant={variant === "destructive" ? "destructive" : "default"}
        className={cn("pr-10", action && "pb-12")}
      >
        {variant === "success" && <CheckCircle2 className="h-4 w-4" />}
        {variant === "destructive" && <AlertCircle className="h-4 w-4" />}
        <AlertTitle>{title}</AlertTitle>
        {description && <AlertDescription>{description}</AlertDescription>}
        {action && (
          <div className="mt-3 flex justify-end">
            <Button
              variant="outline"
              size="medium"
              onClick={() => {
                action.onClick();
                onClose(id);
              }}
              className="h-8 text-xs"
            >
              {actionLabel}
            </Button>
          </div>
        )}
      </Alert>
      <button
        onClick={handleClose}
        className={cn(
          "absolute top-4 right-4 rounded-md p-1 opacity-70 hover:opacity-100 transition-opacity",
          variant === "destructive" && "text-destructive hover:bg-destructive/10",
          "text-muted-foreground hover:bg-secondary"
        )}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onClose: (id: string) => void;
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-full max-w-md px-4 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastComponent toast={toast} onClose={onClose} />
        </div>
      ))}
    </div>
  );
}

