"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BaseGroup, BaseCategory, BaseSubcategory } from "@/src/domain/categories/categories.types";

type Category = BaseCategory & { subcategories?: Subcategory[] };
type Subcategory = BaseSubcategory;
type Macro = BaseGroup;

interface CategorySelectProps {
  macroId?: string;
  categoryId?: string;
  subcategoryId?: string;
  onMacroChange?: (macroId: string) => void;
  onCategoryChange?: (categoryId: string) => void;
  onSubcategoryChange?: (subcategoryId: string) => void;
  includeSubcategory?: boolean;
}

export function CategorySelect({
  macroId,
  categoryId,
  subcategoryId,
  onMacroChange,
  onCategoryChange,
  onSubcategoryChange,
  includeSubcategory = true,
}: CategorySelectProps) {
  const [macros, setMacros] = useState<Macro[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [selectedMacroId, setSelectedMacroId] = useState<string>(macroId || "");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(categoryId || "");
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>(subcategoryId || "");

  useEffect(() => {
    async function loadMacros() {
      try {
        const response = await fetch("/api/v2/categories?consolidated=true");
        if (!response.ok) {
          throw new Error("Failed to fetch categories");
        }
        const { groups } = await response.json();
        setMacros(groups || []);
      } catch (error) {
        console.error("Error loading macros:", error);
      }
    }
    loadMacros();
  }, []);

  useEffect(() => {
    if (selectedMacroId) {
      async function loadCategories() {
        try {
          const response = await fetch(`/api/v2/categories?macroId=${selectedMacroId}`);
          if (!response.ok) {
            throw new Error("Failed to fetch categories");
          }
          const categories = await response.json();
          setCategories(categories || []);
          setSubcategories([]);
          setSelectedCategoryId("");
          setSelectedSubcategoryId("");
          onCategoryChange?.("");
          onSubcategoryChange?.("");
        } catch (error) {
          console.error("Error loading categories:", error);
        }
      }
      loadCategories();
    }
  }, [selectedMacroId, onCategoryChange, onSubcategoryChange]);

  useEffect(() => {
    if (selectedCategoryId) {
      async function loadSubcategories() {
        try {
          const response = await fetch(`/api/v2/categories?categoryId=${selectedCategoryId}`);
          if (!response.ok) {
            throw new Error("Failed to fetch subcategories");
          }
          const subcategories = await response.json();
          setSubcategories(subcategories || []);
          setSelectedSubcategoryId("");
          onSubcategoryChange?.("");
        } catch (error) {
          console.error("Error loading subcategories:", error);
        }
      }
      loadSubcategories();
    } else {
      setSubcategories([]);
    }
  }, [selectedCategoryId, onSubcategoryChange]);

  const handleMacroChange = (value: string) => {
    setSelectedMacroId(value);
    onMacroChange?.(value);
  };

  const handleCategoryChange = (value: string) => {
    setSelectedCategoryId(value);
    onCategoryChange?.(value);
  };

  const handleSubcategoryChange = (value: string) => {
    setSelectedSubcategoryId(value);
    onSubcategoryChange?.(value);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <label className="text-sm font-medium mb-2 block">Group</label>
        <Select value={selectedMacroId} onValueChange={handleMacroChange}>
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

      <div>
        <label className="text-sm font-medium mb-2 block">Category</label>
        <Select
          value={selectedCategoryId}
          onValueChange={handleCategoryChange}
          disabled={!selectedMacroId}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {includeSubcategory && (
        <div>
          <label className="text-sm font-medium mb-2 block">Subcategory</label>
          <Select
            value={selectedSubcategoryId}
            onValueChange={handleSubcategoryChange}
            disabled={!selectedCategoryId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select subcategory" />
            </SelectTrigger>
            <SelectContent>
              {subcategories.map((subcategory) => (
                <SelectItem key={subcategory.id} value={subcategory.id}>
                  {subcategory.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
