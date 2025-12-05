"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

interface CustomOnboardingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "4xl";
  preventClose?: boolean;
  onEscapeKeyDown?: (e: KeyboardEvent) => void;
  onInteractOutside?: (e: Event) => void;
}

const CustomOnboardingDialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 backdrop-blur-sm",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
CustomOnboardingDialogOverlay.displayName = "CustomOnboardingDialogOverlay";

export function CustomOnboardingDialog({
  open,
  onOpenChange,
  children,
  className,
  maxWidth = "4xl",
  preventClose = false,
  onEscapeKeyDown,
  onInteractOutside,
}: CustomOnboardingDialogProps) {
  const maxWidthClasses = {
    sm: "sm:max-w-sm",
    md: "sm:max-w-md",
    lg: "sm:max-w-lg",
    xl: "sm:max-w-xl",
    "2xl": "sm:max-w-2xl",
    "4xl": "sm:max-w-4xl",
  };

  const handleEscapeKeyDown = React.useCallback(
    (e: KeyboardEvent) => {
      if (preventClose) {
        e.preventDefault();
      }
      onEscapeKeyDown?.(e);
    },
    [preventClose, onEscapeKeyDown]
  );

  const handleInteractOutside = React.useCallback(
    (e: Event) => {
      if (preventClose) {
        e.preventDefault();
      }
      onInteractOutside?.(e);
    },
    [preventClose, onInteractOutside]
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <CustomOnboardingDialogOverlay />
        <DialogPrimitive.Content
          className={cn(
            // Mobile: fullscreen
            "fixed z-50 flex flex-col",
            "w-screen h-screen max-w-screen max-h-screen",
            "m-0 rounded-none border bg-background p-0",
            "overflow-clip",
            "left-0 top-0 translate-x-0 translate-y-0",
            "duration-200",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
            // Desktop: centered modal
            "sm:left-[50%] sm:top-[50%]",
            "sm:w-full sm:h-auto sm:max-h-[90vh]",
            maxWidthClasses[maxWidth],
            "sm:translate-x-[-50%] sm:translate-y-[-50%]",
            "sm:rounded-lg sm:m-4",
            "sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=closed]:slide-out-to-top-[48%]",
            "sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=open]:slide-in-from-top-[48%]",
            className
          )}
          onEscapeKeyDown={handleEscapeKeyDown}
          onInteractOutside={handleInteractOutside}
        >
          {/* Hidden title and description for accessibility */}
          <DialogPrimitive.Title className="sr-only">
            Onboarding
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Complete your onboarding to get started with Spare Finance
          </DialogPrimitive.Description>
          <div className="flex flex-col h-full overflow-y-auto">
            {children}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

