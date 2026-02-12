"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UnifiedEntitiesTable } from "@/components/admin/unified-entities-table";
import { CategoryDialog } from "@/components/admin/category-dialog";
import { SubcategoryDialog } from "@/components/admin/subcategory-dialog";
import { BulkImportDialog } from "@/components/admin/bulk-import-dialog";
import { Plus, Upload, ChevronDown, Search } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SystemCategory, SystemSubcategory } from "@/src/domain/admin/admin.types";

interface SystemEntitiesPageClientProps {
  initialGroups: never[];
  initialCategories: SystemCategory[];
  initialSubcategories: SystemSubcategory[];
}

export function SystemEntitiesPageClient({
  initialGroups: _initialGroups,
  initialCategories,
  initialSubcategories,
}: SystemEntitiesPageClientProps) {
  const router = useRouter();

  const categoriesWithDates = React.useMemo(() => {
    return initialCategories.map(cat => ({
      ...cat,
      createdAt: typeof cat.createdAt === 'string' ? new Date(cat.createdAt) : cat.createdAt,
      updatedAt: typeof cat.updatedAt === 'string' ? new Date(cat.updatedAt) : cat.updatedAt,
      subcategories: cat.subcategories?.map(sub => ({
        ...sub,
        createdAt: typeof sub.createdAt === 'string' ? new Date(sub.createdAt) : sub.createdAt,
        updatedAt: typeof sub.updatedAt === 'string' ? new Date(sub.updatedAt) : sub.updatedAt,
      })),
    }));
  }, [initialCategories]);

  const subcategoriesWithDates = React.useMemo(() => {
    return initialSubcategories.map(sub => ({
      ...sub,
      createdAt: typeof sub.createdAt === 'string' ? new Date(sub.createdAt) : sub.createdAt,
      updatedAt: typeof sub.updatedAt === 'string' ? new Date(sub.updatedAt) : sub.updatedAt,
    }));
  }, [initialSubcategories]);

  const [categories, setCategories] = useState<SystemCategory[]>(categoriesWithDates);
  const [subcategories, setSubcategories] = useState<SystemSubcategory[]>(subcategoriesWithDates);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<SystemCategory | null>(null);
  const [isSubcategoryDialogOpen, setIsSubcategoryDialogOpen] = useState(false);
  const [editingSubcategory, setEditingSubcategory] = useState<SystemSubcategory | null>(null);
  const [isBulkImportDialogOpen, setIsBulkImportDialogOpen] = useState(false);

  function handleCreateCategory() {
    setEditingCategory(null);
    setIsCategoryDialogOpen(true);
  }

  function handleEditCategory(category: SystemCategory) {
    setEditingCategory(category);
    setIsCategoryDialogOpen(true);
  }

  async function handleDeleteCategory(id: string) {
    const response = await fetch(`/api/admin/categories?id=${id}`, { method: "DELETE" });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete category");
    }
    router.refresh();
  }

  function handleCreateSubcategory() {
    setEditingSubcategory(null);
    setIsSubcategoryDialogOpen(true);
  }

  function handleEditSubcategory(subcategory: SystemSubcategory) {
    setEditingSubcategory(subcategory);
    setIsSubcategoryDialogOpen(true);
  }

  async function handleDeleteSubcategory(id: string) {
    const response = await fetch(`/api/admin/subcategories?id=${id}`, { method: "DELETE" });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete subcategory");
    }
    router.refresh();
  }

  async function handleBulkDelete(items: Array<{ id: string; type: "category" | "subcategory" }>) {
    const deletePromises = items.map(async (item) => {
      const endpoint = item.type === "category" ? `/api/admin/categories?id=${item.id}` : `/api/admin/subcategories?id=${item.id}`;
      const response = await fetch(endpoint, { method: "DELETE" });
      return { response, item };
    });
    const results = await Promise.all(deletePromises);
    const errors = results.filter(({ response }) => !response.ok).map(({ item }) => `Failed to delete ${item.type} "${item.id}"`);
    if (errors.length > 0) throw new Error(errors.join("\n"));
    router.refresh();
  }

  function handleSuccess() {
    router.refresh();
  }

  React.useEffect(() => {
    setCategories(categoriesWithDates);
    setSubcategories(subcategoriesWithDates);
  }, [categoriesWithDates, subcategoriesWithDates]);

  const filteredEntities = useMemo(() => {
    if (!searchTerm.trim()) return { categories, subcategories };
    const searchLower = searchTerm.toLowerCase().trim();
    const matchingSubcategoryIds = new Set<string>();
    const matchingCategoryIds = new Set<string>();
    subcategories.forEach((sub) => {
      if (sub.name.toLowerCase().includes(searchLower)) {
        matchingSubcategoryIds.add(sub.id);
        matchingCategoryIds.add(sub.categoryId);
      }
    });
    categories.forEach((cat) => {
      if (cat.name.toLowerCase().includes(searchLower)) matchingCategoryIds.add(cat.id);
    });
    return {
      categories: categories.filter((c) => matchingCategoryIds.has(c.id)),
      subcategories: subcategories.filter((s) => matchingCategoryIds.has(s.categoryId) || matchingSubcategoryIds.has(s.id)),
    };
  }, [searchTerm, categories, subcategories]);

  return (
    <div className="w-full p-4 lg:p-8">
      <div className="space-y-2 pb-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold tracking-tight">System Entities</h2>
          <div className="flex items-center gap-2">
            <Button onClick={() => setIsBulkImportDialogOpen(true)} variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Bulk Import
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="flex items-center justify-center">
                  <Plus className="h-4 w-4 mr-2" />
                  <span>Create</span>
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleCreateCategory}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Category
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCreateSubcategory}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Subcategory
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search categories or subcategories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <UnifiedEntitiesTable
          groups={[]}
          categories={filteredEntities.categories}
          subcategories={filteredEntities.subcategories}
          loading={false}
          onEditGroup={() => {}}
          onDeleteGroup={() => {}}
          onEditCategory={handleEditCategory}
          onDeleteCategory={handleDeleteCategory}
          onEditSubcategory={handleEditSubcategory}
          onDeleteSubcategory={handleDeleteSubcategory}
          onBulkDelete={handleBulkDelete}
        />
      </div>

      <CategoryDialog
        open={isCategoryDialogOpen}
        onOpenChange={(open) => {
          setIsCategoryDialogOpen(open);
          if (!open) setEditingCategory(null);
        }}
        category={editingCategory}
        onSuccess={handleSuccess}
      />

      <SubcategoryDialog
        open={isSubcategoryDialogOpen}
        onOpenChange={(open) => {
          setIsSubcategoryDialogOpen(open);
          if (!open) setEditingSubcategory(null);
        }}
        subcategory={editingSubcategory}
        availableCategories={categories.map((c) => ({ id: c.id, name: c.name }))}
        onSuccess={handleSuccess}
      />

      <BulkImportDialog
        open={isBulkImportDialogOpen}
        onOpenChange={setIsBulkImportDialogOpen}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
