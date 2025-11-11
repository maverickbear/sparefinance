"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { SystemMacro } from "@/lib/api/admin";

const macroSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or less"),
});

type MacroFormData = z.infer<typeof macroSchema>;

interface MacroDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  macro?: SystemMacro | null;
  onSuccess?: () => void;
}

export function MacroDialog({
  open,
  onOpenChange,
  macro,
  onSuccess,
}: MacroDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<MacroFormData>({
    resolver: zodResolver(macroSchema),
    defaultValues: macro
      ? {
          name: macro.name,
        }
      : {
          name: "",
        },
  });

  const onSubmit = async (data: MacroFormData) => {
    setIsSubmitting(true);
    try {
      if (macro) {
        // Update
        const response = await fetch("/api/admin/macros", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: macro.id,
            name: data.name,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to update macro");
        }
      } else {
        // Create
        const response = await fetch("/api/admin/macros", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: data.name,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to create macro");
        }
      }

      onOpenChange(false);
      form.reset();
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error saving macro:", error);
      alert(error instanceof Error ? error.message : "Failed to save macro");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {macro ? "Edit System Macro" : "Create System Macro"}
          </DialogTitle>
          <DialogDescription>
            {macro
              ? "Update the system macro name below."
              : "Create a new system macro that will be available to all users."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              {...form.register("name")}
              placeholder="e.g., Entertainment"
              required
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {macro ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

