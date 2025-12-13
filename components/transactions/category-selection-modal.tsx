"use client";

import { useState, useEffect, useCallback } from "react";
import { logger } from "@/src/infrastructure/utils/logger";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Transaction } from "@/src/domain/transactions/transactions.types";
import type { Category } from "@/src/domain/categories/categories.types";

interface CategorySelectionModalProps {
  transaction: Transaction | null;
  categories: Category[];
  onSelect: (categoryId: string | null, subcategoryId: string | null) => void;
  onClear: () => void;
  clearTrigger?: number;
}

export function CategorySelectionModal({
  transaction,
  categories,
  onSelect,
  onClear,
  clearTrigger,
}: CategorySelectionModalProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>("");
  const [subcategories, setSubcategories] = useState<Array<{ id: string; name: string }>>([]);

  const loadSubcategories = useCallback(async (categoryId: string) => {
    try {
      const response = await fetch(`/api/v2/categories?categoryId=${categoryId}`);
      if (response.ok) {
        const data = await response.json();
        setSubcategories(data || []);
      }
    } catch (error) {
      logger.error("Error loading subcategories:", error);
      setSubcategories([]);
    }
  }, []);

  // Initialize with transaction's current category/subcategory
  useEffect(() => {
    async function initialize() {
      if (transaction) {
        setSelectedCategoryId(transaction.categoryId || "");
        setSelectedSubcategoryId(transaction.subcategoryId || "");
        
        if (transaction.categoryId) {
          // Find the category in the provided categories list
          const category = categories.find(c => c.id === transaction.categoryId);
          if (category) {
            // Load subcategories if category is selected
            if (category.subcategories && category.subcategories.length > 0) {
              setSubcategories(category.subcategories);
            } else {
              await loadSubcategories(transaction.categoryId);
            }
          }
        } else {
          setSelectedCategoryId("");
          setSelectedSubcategoryId("");
          setSubcategories([]);
        }
      } else {
        setSelectedCategoryId("");
        setSelectedSubcategoryId("");
        setSubcategories([]);
      }
    }
    initialize();
  }, [transaction, categories, loadSubcategories]);

  // Handle clear trigger
  useEffect(() => {
    if (clearTrigger !== undefined && clearTrigger > 0) {
      setSelectedCategoryId("");
      setSelectedSubcategoryId("");
      setSubcategories([]);
      onClear();
    }
  }, [clearTrigger, onClear]);

  function handleCategoryChange(categoryId: string) {
    setSelectedCategoryId(categoryId);
    setSelectedSubcategoryId("");
    
    if (categoryId) {
      const category = categories.find(c => c.id === categoryId);
      if (category?.subcategories && category.subcategories.length > 0) {
        setSubcategories(category.subcategories);
      } else {
        loadSubcategories(categoryId);
      }
    } else {
      setSubcategories([]);
    }
  }

  // Call onSelect when values change
  useEffect(() => {
    if (onSelect) {
      onSelect(
        selectedCategoryId ? selectedCategoryId : null,
        selectedSubcategoryId ? selectedSubcategoryId : null
      );
    }
  }, [selectedCategoryId, selectedSubcategoryId, onSelect]);

  return (
    <div className="space-y-4 px-6 pt-6 pb-6">
      <div className="space-y-2">
        <label className="text-sm font-medium">Category</label>
        <Select
          value={selectedCategoryId || undefined}
          onValueChange={handleCategoryChange}
        >
          <SelectTrigger size="medium">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {categories.length > 0 ? (
              categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))
            ) : (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                No categories available
              </div>
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Subcategory</label>
        <Select
          value={selectedSubcategoryId || undefined}
          onValueChange={setSelectedSubcategoryId}
        >
          <SelectTrigger size="medium">
            <SelectValue placeholder={selectedCategoryId ? "Select subcategory (optional)" : "Select a category first"} />
          </SelectTrigger>
          <SelectContent>
            {subcategories.length > 0 ? (
              subcategories.map((subcategory) => (
                <SelectItem key={subcategory.id} value={subcategory.id}>
                  {subcategory.name}
                </SelectItem>
              ))
            ) : (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                {selectedCategoryId ? "No subcategories available" : "Select a category first"}
              </div>
            )}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
