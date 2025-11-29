"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CategorySelectionModal } from "./category-selection-modal";
import type { Transaction } from "@/src/domain/transactions/transactions.types";
import type { Category } from "@/src/domain/categories/categories.types";

interface CategorySelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  categories: Category[];
  selectedCategoryId: string | null;
  selectedSubcategoryId: string | null;
  onCategorySelect: (categoryId: string | null, subcategoryId: string | null) => void;
  onClear: () => void;
  onSave: () => void;
  clearTrigger: number;
}

export function CategorySelectionDialog({
  open,
  onOpenChange,
  transaction,
  categories,
  selectedCategoryId,
  selectedSubcategoryId,
  onCategorySelect,
  onClear,
  onSave,
  clearTrigger,
}: CategorySelectionDialogProps) {
  const handleClear = () => {
    onClear();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {transaction?.category?.name ? "Change Category" : "Add Category"}
          </DialogTitle>
          <DialogDescription>
            Select a category for this transaction
          </DialogDescription>
        </DialogHeader>
        <CategorySelectionModal
          transaction={transaction}
          categories={categories}
          onSelect={onCategorySelect}
          onClear={onClear}
          clearTrigger={clearTrigger}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClear}>
            Clear
          </Button>
          <Button type="button" onClick={onSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

