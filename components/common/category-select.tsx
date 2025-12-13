"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BaseCategory, BaseSubcategory } from "@/src/domain/categories/categories.types";

type Category = BaseCategory & { subcategories?: Subcategory[] };
type Subcategory = BaseSubcategory;

interface CategorySelectProps {
  categoryId?: string;
  subcategoryId?: string;
  type?: "income" | "expense"; // Transaction type to filter categories
  onCategoryChange?: (categoryId: string) => void;
  onSubcategoryChange?: (subcategoryId: string) => void;
  includeSubcategory?: boolean;
}

export function CategorySelect({
  categoryId,
  subcategoryId,
  type = "expense", // Default to expense
  onCategoryChange,
  onSubcategoryChange,
  includeSubcategory = true,
}: CategorySelectProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(categoryId || "");
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>(subcategoryId || "");

  useEffect(() => {
    async function loadCategories() {
      try {
        const response = await fetch("/api/v2/categories?all=true");
        if (!response.ok) {
          throw new Error("Failed to fetch categories");
        }
        const categories = await response.json();
        // Filter categories by type
        const filteredCategories = categories.filter((cat: Category) => cat.type === type);
        setCategories(filteredCategories || []);
      } catch (error) {
        console.error("Error loading categories:", error);
        setCategories([]);
      }
    }
    loadCategories();
  }, [type]);

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
          setSubcategories([]);
        }
      }
      loadSubcategories();
    } else {
      setSubcategories([]);
    }
  }, [selectedCategoryId, onSubcategoryChange]);

  const handleCategoryChange = (value: string) => {
    setSelectedCategoryId(value);
    onCategoryChange?.(value);
  };

  const handleSubcategoryChange = (value: string) => {
    setSelectedSubcategoryId(value);
    onSubcategoryChange?.(value);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="text-sm font-medium mb-2 block">Category</label>
        <Select
          value={selectedCategoryId}
          onValueChange={handleCategoryChange}
        >
          <SelectTrigger size="medium">
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
            <SelectTrigger size="medium">
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
