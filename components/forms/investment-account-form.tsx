"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { investmentAccountSchema, InvestmentAccountFormData } from "@/src/domain/investments/investments.validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";
import { useToast } from "@/components/toast-provider";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";

interface InvestmentAccountFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function InvestmentAccountForm({ 
  open, 
  onOpenChange, 
  onSuccess 
}: InvestmentAccountFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<InvestmentAccountFormData>({
    resolver: zodResolver(investmentAccountSchema),
    defaultValues: {
      name: "",
    },
  });

  async function onSubmit(data: InvestmentAccountFormData) {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/investments/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create investment account");
      }

      const account = await res.json();

      toast({
        title: "Success",
        description: "Investment account created successfully",
      });

      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error creating investment account:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create investment account",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-h-[90vh] flex flex-col !p-0 !gap-0">
        <DialogHeader>
          <DialogTitle>Create Investment Account</DialogTitle>
          <DialogDescription>
            Create a new investment account to track your investments
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          <div className="space-y-2">
            <Label>Account Name</Label>
            <Input
              placeholder="e.g., RRSP, TFSA, Brokerage"
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              This will create an investment account in your accounts list.
            </p>
          </div>
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
              Create Account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

