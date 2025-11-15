"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import type { SystemGroup } from "@/lib/api/admin";

const groupSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or less"),
  type: z.enum(["income", "expense"]).optional(),
});

type GroupFormData = z.infer<typeof groupSchema>;

interface GroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group?: SystemGroup | null;
  onSuccess?: () => void;
}

export function GroupDialog({
  open,
  onOpenChange,
  group,
  onSuccess,
}: GroupDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [groupNamesText, setGroupNamesText] = useState("");
  // For create mode: selected type (shared for all groups)
  const [selectedType, setSelectedType] = useState<"income" | "expense">("expense");

  const form = useForm<GroupFormData>({
    resolver: zodResolver(groupSchema),
    defaultValues: group
      ? {
          name: group.name,
          type: group.type || "expense",
        }
      : {
          name: "",
          type: "expense",
        },
  });

  // Reset textarea when dialog opens/closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setGroupNamesText("");
      setSelectedType("expense");
      form.reset();
    }
    onOpenChange(newOpen);
  };

  // Helper function to parse comma-separated values
  const parseCommaSeparated = (text: string): string[] => {
    return text
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Parse comma-separated values
    const groupNames = parseCommaSeparated(groupNamesText);
    
    if (groupNames.length === 0) {
      alert("Please enter at least one group name");
      return;
    }

    setIsSubmitting(true);
    try {
      // Create all groups
      const results = await Promise.allSettled(
        groupNames.map((name) =>
          fetch("/api/admin/groups", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name,
              type: selectedType,
            }),
          })
        )
      );

      // Check for errors
      const errors: string[] = [];
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const groupName = groupNames[i];
        
        if (result.status === "rejected") {
          errors.push(`Failed to create "${groupName}": ${result.reason}`);
        } else if (!result.value.ok) {
          try {
            const errorData = await result.value.json();
            errors.push(`Failed to create "${groupName}": ${errorData.error || "Unknown error"}`);
          } catch (parseError) {
            errors.push(`Failed to create "${groupName}": HTTP ${result.value.status}`);
          }
        }
      }

      if (errors.length > 0) {
        const successCount = results.length - errors.length;
        if (successCount > 0) {
          alert(`${successCount} group${successCount > 1 ? "s" : ""} created successfully.\n\nErrors:\n${errors.join("\n")}`);
        } else {
          throw new Error(errors.join("\n"));
        }
      }

      handleOpenChange(false);
      form.reset();
      setGroupNamesText("");
      setSelectedType("expense");
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error saving group:", error);
      alert(error instanceof Error ? error.message : "Failed to save group");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmit = async (data: GroupFormData) => {
    setIsSubmitting(true);
    try {
      // Update mode: single group
        const response = await fetch("/api/admin/groups", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: group!.id,
            name: data.name,
            type: form.watch("type") || group!.type || "expense",
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to update group");
        }

      handleOpenChange(false);
      form.reset();
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error saving group:", error);
      alert(error instanceof Error ? error.message : "Failed to save group");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px] sm:max-h-[90vh] flex flex-col !p-0 !gap-0">
        <DialogHeader>
          <DialogTitle>
            {group ? "Edit System Group" : "Create System Groups"}
          </DialogTitle>
          <DialogDescription>
            {group
              ? "Update the system group name below."
              : "Create one or more system groups separated by commas. They will be available to all users."}
          </DialogDescription>
        </DialogHeader>

        <form 
          onSubmit={group ? form.handleSubmit(onSubmit) : handleCreateSubmit} 
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {group ? (
            // Edit mode: single input
            <>
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
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={form.watch("type") || group.type || "expense"}
                  onValueChange={(value) => form.setValue("type", value as "income" | "expense")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            // Create mode: textarea with comma-separated values
            <>
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={selectedType}
                  onValueChange={(value) => setSelectedType(value as "income" | "expense")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="groupNames">Group Names (comma-separated)</Label>
                <Textarea
                  id="groupNames"
                  value={groupNamesText}
                  onChange={(e) => setGroupNamesText(e.target.value)}
                  placeholder="e.g., Entertainment, Shopping, Travel"
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Enter multiple group names separated by commas. Each will be created as a separate group.
                </p>
              </div>
            </>
          )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={
                isSubmitting || 
                (!group && parseCommaSeparated(groupNamesText).length === 0)
              }
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {group ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

