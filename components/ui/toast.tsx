"use client";

import * as React from "react";
import { X, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "success" | "destructive";
}

interface ToastProps {
  toast: Toast;
  onClose: (id: string) => void;
}

export function ToastComponent({ toast, onClose }: ToastProps) {
  const { id, title, description, variant = "default" } = toast;

  React.useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, 3000);

    return () => clearTimeout(timer);
  }, [id, onClose]);

  const variantStyles = {
    default: "bg-background border-border",
    success: "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800",
    destructive: "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800",
  };

  const iconStyles = {
    default: "text-foreground",
    success: "text-green-600 dark:text-green-400",
    destructive: "text-red-600 dark:text-red-400",
  };

  return (
    <div
      className={cn(
        "relative flex items-start gap-3 rounded-lg border p-4 shadow-lg transition-all animate-in slide-in-from-top-5 fade-in-0 duration-300",
        variantStyles[variant]
      )}
    >
      {variant === "success" && (
        <CheckCircle2 className={cn("h-5 w-5 flex-shrink-0 mt-0.5", iconStyles[variant])} />
      )}
      {variant === "destructive" && (
        <AlertCircle className={cn("h-5 w-5 flex-shrink-0 mt-0.5", iconStyles[variant])} />
      )}
      <div className="flex-1 space-y-1">
        <p className={cn("text-sm font-medium", variant === "success" && "text-green-900 dark:text-green-100", variant === "destructive" && "text-red-900 dark:text-red-100")}>
          {title}
        </p>
        {description && (
          <p className={cn("text-sm opacity-90", variant === "success" && "text-green-800 dark:text-green-200", variant === "destructive" && "text-red-800 dark:text-red-200")}>
            {description}
          </p>
        )}
      </div>
      <button
        onClick={() => onClose(id)}
        className={cn(
          "rounded-md p-1 opacity-70 hover:opacity-100 transition-opacity",
          variant === "success" && "text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900",
          variant === "destructive" && "text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900"
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

