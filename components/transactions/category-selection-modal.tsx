"use client";

import { useState, useEffect, useCallback } from "react";
import { logger } from "@/lib/utils/logger";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Transaction } from "@/lib/api/transactions-client";
import type { Category, Macro } from "@/lib/api/categories-client";
import { getMacrosClient } from "@/lib/api/categories-client";

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
  const [macros, setMacros] = useState<Macro[]>([]);
  const [selectedMacroId, setSelectedMacroId] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>("");
  const [availableCategories, setAvailableCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Array<{ id: string; name: string }>>([]);

  const loadCategoriesForMacro = useCallback(async (macroId: string) => {
    try {
      const response = await fetch(`/api/categories?macroId=${macroId}`);
      if (response.ok) {
        const data = await response.json();
        setAvailableCategories(data || []);
      }
    } catch (error) {
      logger.error("Error loading categories:", error);
      setAvailableCategories([]);
    }
  }, []);

  const loadSubcategories = useCallback(async (categoryId: string) => {
    try {
      const response = await fetch(`/api/categories?categoryId=${categoryId}`);
      if (response.ok) {
        const data = await response.json();
        setSubcategories(data || []);
      }
    } catch (error) {
      logger.error("Error loading subcategories:", error);
      setSubcategories([]);
    }
  }, []);

  // Load macros on mount
  useEffect(() => {
    async function loadMacros() {
      const macrosData = await getMacrosClient();
      setMacros(macrosData);
    }
    loadMacros();
  }, []);

  // Initialize with transaction's current category/subcategory
  useEffect(() => {
    async function initialize() {
      if (transaction) {
        setSelectedCategoryId(transaction.categoryId || "");
        setSelectedSubcategoryId(transaction.subcategoryId || "");
        
        // Find the category and its macro
        if (transaction.categoryId) {
          const category = categories.find(c => c.id === transaction.categoryId);
          if (category) {
            setSelectedMacroId(category.groupId || "");
            
            // Load categories for the macro
            if (category.groupId) {
              await loadCategoriesForMacro(category.groupId);
            }
            
            // Load subcategories if category is selected
            if (category.subcategories && category.subcategories.length > 0) {
              setSubcategories(category.subcategories);
            } else {
              await loadSubcategories(transaction.categoryId);
            }
          }
        } else {
          setSelectedMacroId("");
          setSelectedCategoryId("");
          setSelectedSubcategoryId("");
          setAvailableCategories([]);
          setSubcategories([]);
        }
      } else {
        setSelectedMacroId("");
        setSelectedCategoryId("");
        setSelectedSubcategoryId("");
        setAvailableCategories([]);
        setSubcategories([]);
      }
    }
    initialize();
  }, [transaction, categories, loadCategoriesForMacro, loadSubcategories]);

  // Handle clear trigger
  useEffect(() => {
    if (clearTrigger !== undefined && clearTrigger > 0) {
      setSelectedMacroId("");
      setSelectedCategoryId("");
      setSelectedSubcategoryId("");
      setAvailableCategories([]);
      setSubcategories([]);
      onClear();
    }
  }, [clearTrigger, onClear]);

  function handleMacroChange(macroId: string) {
    setSelectedMacroId(macroId);
    setSelectedCategoryId("");
    setSelectedSubcategoryId("");
    setSubcategories([]);
    
    if (macroId) {
      loadCategoriesForMacro(macroId);
    } else {
      setAvailableCategories([]);
    }
  }

  function handleCategoryChange(categoryId: string) {
    setSelectedCategoryId(categoryId);
    setSelectedSubcategoryId("");
    
    if (categoryId) {
      const category = availableCategories.find(c => c.id === categoryId);
      if (category?.subcategories && category.subcategories.length > 0) {
        setSubcategories(category.subcategories);
      } else {
        loadSubcategories(categoryId);
      }
    } else {
      setSubcategories([]);
    }
  }


  function handleClear() {
    setSelectedMacroId("");
    setSelectedCategoryId("");
    setSelectedSubcategoryId("");
    setAvailableCategories([]);
    setSubcategories([]);
    onClear();
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
    <div className="space-y-4 px-6">
      <div className="space-y-2">
        <label className="text-sm font-medium">Group (Macro)</label>
        <Select
          value={selectedMacroId || undefined}
          onValueChange={handleMacroChange}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select group" />
          </SelectTrigger>
          <SelectContent>
            {macros.map((macro) => (
              <SelectItem key={macro.id} value={macro.id}>
                {macro.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Category</label>
        <Select
          value={selectedCategoryId || undefined}
          onValueChange={handleCategoryChange}
        >
          <SelectTrigger>
            <SelectValue placeholder={selectedMacroId ? "Select category" : "Select a group first"} />
          </SelectTrigger>
          <SelectContent>
            {availableCategories.length > 0 ? (
              availableCategories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))
            ) : (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                {selectedMacroId ? "No categories available" : "Select a group first"}
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
          <SelectTrigger>
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


