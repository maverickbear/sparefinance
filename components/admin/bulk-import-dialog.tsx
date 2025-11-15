"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface ImportLine {
  type?: "income" | "expense";
  group: string;
  category: string;
  subcategory: string;
}

export function BulkImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: BulkImportDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importText, setImportText] = useState("");
  const [defaultType, setDefaultType] = useState<"income" | "expense">("expense");

  // Parse import text into structured data
  const parseImportText = (text: string): ImportLine[] => {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    return lines.map((line) => {
      const parts = line.split(",").map((part) => part.trim());
      
      // Check if first part is a type indicator
      if (parts.length === 4 && (parts[0] === "income" || parts[0] === "expense")) {
        return {
          type: parts[0] as "income" | "expense",
          group: parts[1],
          category: parts[2],
          subcategory: parts[3],
        };
      } else if (parts.length === 3) {
        return {
          type: defaultType,
          group: parts[0],
          category: parts[1],
          subcategory: parts[2],
        };
      } else {
        throw new Error(`Invalid line format: "${line}". Expected format: "Group,Category,Subcategory" or "type,Group,Category,Subcategory"`);
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!importText.trim()) {
      alert("Please enter data to import");
      return;
    }

    setIsSubmitting(true);
    try {
      // Parse the import text
      const importLines = parseImportText(importText);

      // Fetch all existing data once
      const [groupsRes, categoriesRes, subcategoriesRes] = await Promise.all([
        fetch("/api/admin/groups"),
        fetch("/api/admin/categories"),
        fetch("/api/admin/subcategories"),
      ]);

      if (!groupsRes.ok || !categoriesRes.ok || !subcategoriesRes.ok) {
        throw new Error("Failed to fetch existing data");
      }

      const existingGroups = await groupsRes.json();
      const existingCategories = await categoriesRes.json();
      const existingSubcategories = await subcategoriesRes.json();

      // Track created/found groups and categories to avoid duplicates
      const groupMap = new Map<string, string>(); // groupName -> groupId
      const categoryMap = new Map<string, string>(); // "groupName|categoryName" -> categoryId
      const subcategorySet = new Set<string>(); // "categoryId|subcategoryName"

      // Initialize group map with existing groups
      existingGroups.forEach((g: any) => {
        groupMap.set(g.name, g.id);
      });

      // Initialize category map with existing categories
      existingCategories.forEach((c: any) => {
        const groupName = existingGroups.find((g: any) => g.id === c.macroId)?.name;
        if (groupName) {
          categoryMap.set(`${groupName}|${c.name}`, c.id);
        }
      });

      // Initialize subcategory set with existing subcategories
      existingSubcategories.forEach((s: any) => {
        subcategorySet.add(`${s.categoryId}|${s.name}`);
      });

      const errors: string[] = [];
      const results = {
        groupsCreated: 0,
        groupsSkipped: 0,
        categoriesCreated: 0,
        categoriesSkipped: 0,
        subcategoriesCreated: 0,
        subcategoriesSkipped: 0,
      };

      // Process each line
      for (let i = 0; i < importLines.length; i++) {
        const line = importLines[i];
        const lineNumber = i + 1;

        try {
          // Step 1: Get or create Group
          let groupId = groupMap.get(line.group);
          if (!groupId) {
            // Create new group
            const groupRes = await fetch("/api/admin/groups", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: line.group,
                type: line.type || defaultType,
              }),
            });

            if (!groupRes.ok) {
              const errorData = await groupRes.json();
              throw new Error(`Failed to create group "${line.group}": ${errorData.error || "Unknown error"}`);
            }

            const newGroup = await groupRes.json();
            groupId = newGroup.id;
            groupMap.set(line.group, groupId);
            results.groupsCreated++;
          } else {
            results.groupsSkipped++;
          }

          // Step 2: Get or create Category
          const categoryKey = `${line.group}|${line.category}`;
          let categoryId = categoryMap.get(categoryKey);
          if (!categoryId) {
            // Create new category
            const categoryRes = await fetch("/api/admin/categories", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: line.category,
                macroId: groupId,
              }),
            });

            if (!categoryRes.ok) {
              const errorData = await categoryRes.json();
              throw new Error(`Failed to create category "${line.category}": ${errorData.error || "Unknown error"}`);
            }

            const newCategory = await categoryRes.json();
            categoryId = newCategory.id;
            categoryMap.set(categoryKey, categoryId);
            results.categoriesCreated++;
          } else {
            results.categoriesSkipped++;
          }

          // Step 3: Create Subcategory (check if exists first)
          const subcategoryKey = `${categoryId}|${line.subcategory}`;
          if (!subcategorySet.has(subcategoryKey)) {
            const subcategoryRes = await fetch("/api/admin/subcategories", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: line.subcategory,
                categoryId: categoryId,
              }),
            });

            if (!subcategoryRes.ok) {
              const errorData = await subcategoryRes.json();
              throw new Error(`Failed to create subcategory "${line.subcategory}": ${errorData.error || "Unknown error"}`);
            }

            subcategorySet.add(subcategoryKey);
            results.subcategoriesCreated++;
          } else {
            results.subcategoriesSkipped++;
          }
        } catch (error) {
          errors.push(`Line ${lineNumber}: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
      }

      // Show results
      const successMessage = [
        `Import completed!`,
        `Groups: ${results.groupsCreated} created, ${results.groupsSkipped} skipped`,
        `Categories: ${results.categoriesCreated} created, ${results.categoriesSkipped} skipped`,
        `Subcategories: ${results.subcategoriesCreated} created, ${results.subcategoriesSkipped} skipped`,
      ].join("\n");

      if (errors.length > 0) {
        alert(`${successMessage}\n\nErrors:\n${errors.join("\n")}`);
      } else {
        alert(successMessage);
      }

      onOpenChange(false);
      setImportText("");
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error importing data:", error);
      alert(error instanceof Error ? error.message : "Failed to import data");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] sm:max-h-[90vh] flex flex-col !p-0 !gap-0">
        <DialogHeader>
          <DialogTitle>Bulk Import</DialogTitle>
          <DialogDescription>
            Import multiple groups, categories, and subcategories at once. Each line should follow the format:
            <br />
            <code className="text-xs bg-muted px-1 py-0.5 rounded">
              Group,Category,Subcategory
            </code>
            <br />
            Or with type:
            <br />
            <code className="text-xs bg-muted px-1 py-0.5 rounded">
              income|expense,Group,Category,Subcategory
            </code>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="defaultType">Default Type (for lines without type)</Label>
              <select
                id="defaultType"
                value={defaultType}
                onChange={(e) => setDefaultType(e.target.value as "income" | "expense")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="importText">Import Data (one line per entry)</Label>
              <Textarea
                id="importText"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={`Food,Restaurants,Fast Food\nFood,Restaurants,Dine In\nTransportation,Vehicle,Fuel`}
                rows={12}
                className="resize-none font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Each line: <code>Group,Category,Subcategory</code> or <code>type,Group,Category,Subcategory</code>
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
            <Button type="submit" disabled={isSubmitting || !importText.trim()}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Import
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

