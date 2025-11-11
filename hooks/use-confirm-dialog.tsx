"use client";

import { useState, useCallback } from "react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";

interface ConfirmDialogOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
}

interface ConfirmDialogState extends ConfirmDialogOptions {
  open: boolean;
  onConfirm: () => void | Promise<void>;
}

export function useConfirmDialog() {
  const [dialogState, setDialogState] = useState<ConfirmDialogState | null>(null);

  const openDialog = useCallback(
    (
      options: ConfirmDialogOptions,
      onConfirm: () => void | Promise<void>
    ) => {
      setDialogState({
        ...options,
        open: true,
        onConfirm,
      });
    },
    []
  );

  const closeDialog = useCallback(() => {
    setDialogState(null);
  }, []);

  const ConfirmDialogComponent = dialogState ? (
    <ConfirmDialog
      open={dialogState.open}
      onOpenChange={(open) => {
        if (!open) {
          closeDialog();
        }
      }}
      title={dialogState.title}
      description={dialogState.description}
      onConfirm={async () => {
        await dialogState.onConfirm();
        closeDialog();
      }}
      confirmLabel={dialogState.confirmLabel}
      cancelLabel={dialogState.cancelLabel}
      variant={dialogState.variant}
    />
  ) : null;

  return {
    openDialog,
    ConfirmDialog: ConfirmDialogComponent,
  };
}

