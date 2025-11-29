"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { categorySchema, CategoryFormData, subcategorySchema, SubcategoryFormData } from "@/src/domain/categories/categories.validations";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useState, useEffect, useMemo, useRef } from "react";
import { Plus, Edit, X, Check, Loader2, Search } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import type { Category, Macro } from "@/src/domain/categories/categories.types";
import { useDebounce } from "@/hooks/use-debounce";

interface Subcategory {
  id: string;
  name: string;
  categoryId: string;
  userId?: string | null;
  logo?: string | null;
}

interface PendingSubcategory {
  name: string;
  tempId: string;
}

interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: Category | null;
  macros: Macro[];
  onSuccess?: (updatedCategory?: Category) => void;
}

export function CategoryDialog({
  open,
  onOpenChange,
  category,
  macros,
  onSuccess,
}: CategoryDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subcategories, setSubcategories] = useState<Subcategory[]>(
    category?.subcategories?.map((subcat) => ({
      id: subcat.id,
      name: subcat.name,
      categoryId: category.id,
      logo: subcat.logo || null,
    })) || []
  );
  const [pendingSubcategories, setPendingSubcategories] = useState<PendingSubcategory[]>([]);
  const [editingSubcategoryId, setEditingSubcategoryId] = useState<string | null>(null);
  const [editingPendingSubcategoryTempId, setEditingPendingSubcategoryTempId] = useState<string | null>(null);
  const [editingSubcategoryName, setEditingSubcategoryName] = useState("");
  const [editingSubcategoryLogo, setEditingSubcategoryLogo] = useState("");
  const [newSubcategoryName, setNewSubcategoryName] = useState("");
  const [newSubcategoryLogo, setNewSubcategoryLogo] = useState("");
  const [isAddingSubcategory, setIsAddingSubcategory] = useState(false);
  const [isSubmittingSubcategory, setIsSubmittingSubcategory] = useState(false);
  const [deletingSubcategoryId, setDeletingSubcategoryId] = useState<string | null>(null);
  const [currentCategoryId, setCurrentCategoryId] = useState<string | null>(category?.id || null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const searchRef = useRef<HTMLDivElement>(null);
  
  // Check if this is a system category (userId === null)
  // Only system categories when category exists AND userId is null
  // When category is null (new category), isSystemCategory should be false
  const isSystemCategory = category !== null && category !== undefined && category.userId === null;

  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: category
      ? {
          name: category.name,
          macroId: category.groupId || "",
        }
      : {
          name: "",
          macroId: "",
        },
  });

  // Load current user and all categories for search
  useEffect(() => {
    async function loadCurrentUser() {
      try {
        const response = await fetch("/api/user");
        if (response.ok) {
          const data = await response.json();
          setCurrentUserId(data.user?.id || null);
        }
      } catch (error) {
        console.error("Error loading current user:", error);
      }
    }
    
    async function loadAllCategories() {
      try {
        const response = await fetch("/api/v2/categories?all=true");
        if (!response.ok) {
          throw new Error("Failed to fetch categories");
        }
        const categories = await response.json();
        setAllCategories(categories);
      } catch (error) {
        console.error("Error loading categories for search:", error);
      }
    }
    
    if (open) {
      loadCurrentUser();
      loadAllCategories();
    }
  }, [open]);

  // Close search dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    }

    if (searchOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
    return undefined;
  }, [searchOpen]);

  // Reset form and subcategories when dialog opens/closes or category changes
  useEffect(() => {
    if (open) {
      form.reset(
        category
          ? {
              name: category.name,
              macroId: category.groupId || "",
            }
          : {
              name: "",
              macroId: "",
            }
      );
      setSubcategories(
        category?.subcategories?.map((subcat) => ({
          id: subcat.id,
          name: subcat.name,
          categoryId: category.id,
          logo: subcat.logo || null,
        })) || []
      );
      setPendingSubcategories([]);
      setCurrentCategoryId(category?.id || null);
      setEditingSubcategoryId(null);
      setEditingPendingSubcategoryTempId(null);
      setEditingSubcategoryName("");
      setEditingSubcategoryLogo("");
      setNewSubcategoryName("");
      setNewSubcategoryLogo("");
      setIsAddingSubcategory(false);
      setSearchQuery("");
      setSearchOpen(false);
    }
  }, [open, category, form]);

  async function onSubmit(data: CategoryFormData) {
    try {
      setIsSubmitting(true);
      
      // For system categories, skip the category update and just refresh subcategories
      if (isSystemCategory && category) {
        // Refresh the subcategories list and close dialog
        const res = await fetch(`/api/categories?all=true`);
        if (res.ok) {
          const allCategories = await res.json();
          const updatedCategory = allCategories.find((cat: any) => cat.id === category.id);
          if (updatedCategory) {
            setSubcategories(updatedCategory.subcategories || []);
            // Format the category to match the expected type
            const formattedCategory: Category = {
              id: updatedCategory.id,
              name: updatedCategory.name,
              groupId: updatedCategory.groupId,
              userId: updatedCategory.userId,
              group: Array.isArray(updatedCategory.group) 
                ? (updatedCategory.group.length > 0 ? updatedCategory.group[0] : null)
                : updatedCategory.group,
              subcategories: updatedCategory.subcategories || [],
            };
            onSuccess?.(formattedCategory);
          } else {
            onSuccess?.();
          }
        } else {
          onSuccess?.();
        }
        onOpenChange(false);
        return;
      }
      
      const url = category ? `/api/categories/${category.id}` : "/api/categories";
      const method = category ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save category");
      }

      const savedCategory = await res.json();
      setCurrentCategoryId(savedCategory.id);
      
      // If this is a new category with pending subcategories, create them all
      if (!category && pendingSubcategories.length > 0) {
        try {
          const subcategoryPromises = pendingSubcategories.map((pending) =>
            fetch(`/api/categories/${savedCategory.id}/subcategories`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: pending.name }),
            }).then((res) => {
              if (!res.ok) {
                throw new Error(`Failed to create subcategory: ${pending.name}`);
              }
              return res.json();
            })
          );

          const createdSubcategories = await Promise.all(subcategoryPromises);
          setSubcategories(createdSubcategories);
          setPendingSubcategories([]);
          // Update savedCategory with created subcategories
          savedCategory.subcategories = createdSubcategories;
        } catch (error) {
          console.error("Error creating subcategories:", error);
          toast({
            title: "Partial Success",
            description: "Category created but some subcategories failed to create. Please add them manually.",
            variant: "destructive",
          });
        }
      } else {
        setSubcategories(savedCategory.subcategories || []);
      }

      // Format the category to match the expected type
      const formattedCategory: Category = {
        id: savedCategory.id,
        name: savedCategory.name,
        groupId: savedCategory.groupId,
        userId: savedCategory.userId,
        group: Array.isArray(savedCategory.group) 
          ? (savedCategory.group.length > 0 ? savedCategory.group[0] : null)
          : savedCategory.group,
        subcategories: savedCategory.subcategories || [],
      };

      // Only close dialog and reload if editing existing category
      if (category) {
        onSuccess?.(formattedCategory);
        onOpenChange(false);
        form.reset();
      } else {
        // For new categories, notify parent but keep dialog open
        onSuccess?.(formattedCategory);
      }
      // For new categories, keep dialog open to allow adding more subcategories
      toast({
        title: category ? "Category updated" : "Category created",
        description: category ? "Your category has been updated successfully." : "Your category has been created successfully.",
        variant: "success",
      });
    } catch (error) {
      console.error("Error saving category:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save category",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAddSubcategory() {
    const name = newSubcategoryName.trim();
    
    if (!name) {
      toast({
        title: "Validation Error",
        description: "Subcategory name is required",
        variant: "destructive",
      });
      return;
    }

    // If category already exists, create subcategory immediately
    if (currentCategoryId) {
      try {
        setIsSubmittingSubcategory(true);
        const res = await fetch(`/api/categories/${currentCategoryId}/subcategories`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, logo: newSubcategoryLogo.trim() || null }),
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || "Failed to create subcategory");
        }

        const newSubcategory = await res.json();
        setSubcategories([...subcategories, newSubcategory]);
        setNewSubcategoryName("");
        setNewSubcategoryLogo("");
        setIsAddingSubcategory(false);
        // Refresh data for system categories
        if (isSystemCategory && category) {
          // Fetch updated category with all subcategories
          const res = await fetch(`/api/categories?all=true`);
          if (res.ok) {
            const allCategories = await res.json();
            const updatedCategory = allCategories.find((cat: any) => cat.id === category.id);
            if (updatedCategory) {
              const formattedCategory: Category = {
                id: updatedCategory.id,
                name: updatedCategory.name,
                groupId: updatedCategory.groupId,
                userId: updatedCategory.userId,
                group: Array.isArray(updatedCategory.group) 
                  ? (updatedCategory.group.length > 0 ? updatedCategory.group[0] : null)
                  : updatedCategory.group,
                subcategories: updatedCategory.subcategories || [],
              };
              onSuccess?.(formattedCategory);
            } else {
              onSuccess?.();
            }
          } else {
            onSuccess?.();
          }
        }
        
        toast({
          title: "Subcategory created",
          description: "Your subcategory has been created successfully.",
          variant: "success",
        });
      } catch (error) {
        console.error("Error creating subcategory:", error);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to create subcategory",
          variant: "destructive",
        });
      } finally {
        setIsSubmittingSubcategory(false);
      }
    } else {
      // If category doesn't exist yet, add to pending list
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      setPendingSubcategories([...pendingSubcategories, { name, tempId }]);
      setNewSubcategoryName("");
      setIsAddingSubcategory(false);
    }
  }

  async function handleUpdateSubcategory(subcategoryId: string) {
    const name = editingSubcategoryName.trim();
    
    if (!name) {
      alert("Subcategory name is required");
      return;
    }

    try {
      setIsSubmittingSubcategory(true);
      const res = await fetch(`/api/categories/subcategories/${subcategoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, logo: editingSubcategoryLogo.trim() || null }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update subcategory");
      }

      const updatedSubcategory = await res.json();
      const updatedSubcategories = subcategories.map((s) => (s.id === subcategoryId ? updatedSubcategory : s));
      setSubcategories(updatedSubcategories);
      setEditingSubcategoryId(null);
      setEditingSubcategoryName("");
      setEditingSubcategoryLogo("");
      
      // Notify parent if category exists
      if (currentCategoryId && category) {
        const updatedCategory: Category = {
          ...category,
          subcategories: updatedSubcategories,
        };
        onSuccess?.(updatedCategory);
      }
      
      toast({
        title: "Subcategory updated",
        description: "Your subcategory has been updated successfully.",
        variant: "success",
      });
    } catch (error) {
      console.error("Error updating subcategory:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update subcategory",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingSubcategory(false);
    }
  }

  function handleUpdatePendingSubcategory(tempId: string) {
    const name = editingSubcategoryName.trim();
    
    if (!name) {
      alert("Subcategory name is required");
      return;
    }

    setPendingSubcategories(
      pendingSubcategories.map((p) => (p.tempId === tempId ? { ...p, name } : p))
    );
    setEditingPendingSubcategoryTempId(null);
    setEditingSubcategoryName("");
  }

  function handleDeletePendingSubcategory(tempId: string) {
    setPendingSubcategories(pendingSubcategories.filter((p) => p.tempId !== tempId));
  }

  async function handleDeleteSubcategory(subcategoryId: string) {
    if (!confirm("Are you sure you want to delete this subcategory?")) {
      return;
    }

    setDeletingSubcategoryId(subcategoryId);
    try {
      setIsSubmittingSubcategory(true);
      const res = await fetch(`/api/categories/subcategories/${subcategoryId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete subcategory");
      }

      const updatedSubcategories = subcategories.filter((s) => s.id !== subcategoryId);
      setSubcategories(updatedSubcategories);
      
      // Notify parent if category exists
      if (currentCategoryId && category) {
        const updatedCategory: Category = {
          ...category,
          subcategories: updatedSubcategories,
        };
        onSuccess?.(updatedCategory);
      }
      
      toast({
        title: "Subcategory deleted",
        description: "Your subcategory has been deleted successfully.",
        variant: "success",
      });
    } catch (error) {
      console.error("Error deleting subcategory:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete subcategory",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingSubcategory(false);
      setDeletingSubcategoryId(null);
    }
  }

  function startEditingSubcategory(subcategory: Subcategory) {
    setEditingSubcategoryId(subcategory.id);
    setEditingPendingSubcategoryTempId(null);
    setEditingSubcategoryName(subcategory.name);
    setEditingSubcategoryLogo(subcategory.logo || "");
  }

  function startEditingPendingSubcategory(pending: PendingSubcategory) {
    setEditingPendingSubcategoryTempId(pending.tempId);
    setEditingSubcategoryId(null);
    setEditingSubcategoryName(pending.name);
  }

  function cancelEditingSubcategory() {
    setEditingSubcategoryId(null);
    setEditingPendingSubcategoryTempId(null);
    setEditingSubcategoryName("");
    setEditingSubcategoryLogo("");
  }

  // Search functionality - filter groups, categories, and subcategories
  const searchResults = useMemo(() => {
    if (!debouncedSearchQuery.trim()) {
      return {
        groups: [],
        categories: [],
        subcategories: [],
      };
    }

    const query = debouncedSearchQuery.toLowerCase().trim();
    
    // Search in groups (macros)
    const matchedGroups = macros.filter((macro) =>
      macro.name.toLowerCase().includes(query)
    );

    // Search in categories
    const matchedCategories = allCategories.filter((cat) =>
      cat.name.toLowerCase().includes(query)
    );

    // Search in subcategories
    const matchedSubcategories: Array<{
      id: string;
      name: string;
      categoryId: string;
      categoryName: string;
      groupName?: string;
    }> = [];
    
    allCategories.forEach((cat) => {
      cat.subcategories?.forEach((subcat) => {
        if (subcat.name.toLowerCase().includes(query)) {
          matchedSubcategories.push({
            id: subcat.id,
            name: subcat.name,
            categoryId: cat.id,
            categoryName: cat.name,
            groupName: cat.group?.name,
          });
        }
      });
    });

    return {
      groups: matchedGroups,
      categories: matchedCategories,
      subcategories: matchedSubcategories,
    };
  }, [debouncedSearchQuery, macros, allCategories]);

  function handleSearchSelect(type: "group" | "category" | "subcategory", item: any) {
    if (type === "group") {
      form.setValue("macroId", item.id);
      setSearchQuery("");
      setSearchOpen(false);
    } else if (type === "category") {
      form.setValue("macroId", item.groupId || "");
      form.setValue("name", item.name);
      setSearchQuery("");
      setSearchOpen(false);
    } else if (type === "subcategory") {
      // Find the category for this subcategory
      const parentCategory = allCategories.find((cat) => cat.id === item.categoryId);
      if (parentCategory) {
        form.setValue("macroId", parentCategory.groupId || "");
        form.setValue("name", parentCategory.name);
        setSearchQuery("");
        setSearchOpen(false);
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl sm:max-h-[90vh] flex flex-col !p-0 !gap-0">
        <DialogHeader>
          <DialogTitle>{category ? "Edit" : "Add"} Category</DialogTitle>
          <DialogDescription>
            {category
              ? "Update the category details below."
              : "Create a new category by selecting a group and entering a name."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {/* Search functionality - Always visible */}
          <div className="space-y-2" ref={searchRef}>
            <label htmlFor="category-search" className="text-sm font-medium">
              Search Groups, Categories & Subcategories
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="category-search"
                type="text"
                placeholder="Search groups, categories, and subcategories..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchOpen(e.target.value.length > 0);
                }}
                onFocus={() => {
                  if (searchQuery.length > 0) {
                    setSearchOpen(true);
                  }
                }}
                className="pl-9 pr-9"
              />
              {searchQuery && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => {
                    setSearchQuery("");
                    setSearchOpen(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {searchOpen && debouncedSearchQuery && (
              <div className="border rounded-[12px] bg-popover shadow-md max-h-64 overflow-y-auto z-50 relative">
                <Command shouldFilter={false}>
                  <CommandList>
                    <CommandEmpty>
                      No results found.
                    </CommandEmpty>
                    {searchResults.groups.length > 0 && (
                      <CommandGroup heading="Groups">
                        {searchResults.groups.map((group) => (
                          <CommandItem
                            key={group.id}
                            value={`group-${group.id}`}
                            onSelect={() => handleSearchSelect("group", group)}
                            className="cursor-pointer"
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">{group.name}</span>
                              <span className="text-xs text-muted-foreground">Group</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                    {searchResults.categories.length > 0 && (
                      <CommandGroup heading="Categories">
                        {searchResults.categories.map((cat) => (
                          <CommandItem
                            key={cat.id}
                            value={`category-${cat.id}`}
                            onSelect={() => handleSearchSelect("category", cat)}
                            className="cursor-pointer"
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">{cat.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {cat.group?.name || "Category"}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                    {searchResults.subcategories.length > 0 && (
                      <CommandGroup heading="Subcategories">
                        {searchResults.subcategories.map((subcat) => (
                          <CommandItem
                            key={subcat.id}
                            value={`subcategory-${subcat.id}`}
                            onSelect={() => handleSearchSelect("subcategory", subcat)}
                            className="cursor-pointer"
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">{subcat.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {subcat.categoryName}
                                {subcat.groupName && ` • ${subcat.groupName}`}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </div>
            )}
          </div>

          {/* Show group selector and category name when creating new category or editing user category */}
          {(!category || !isSystemCategory) && (
            <>
              <div className="space-y-1">
                <label className="text-sm font-medium">Group</label>
                <Select
                  value={form.watch("macroId")}
                  onValueChange={(value) => form.setValue("macroId", value)}
                  disabled={!!category && isSystemCategory}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select group" />
                  </SelectTrigger>
                  <SelectContent>
                    {macros && macros.length > 0 ? (
                      macros.map((macro) => (
                        <SelectItem key={macro.id} value={macro.id}>
                          {macro.name}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No groups available
                      </div>
                    )}
                  </SelectContent>
                </Select>
                {form.formState.errors.macroId && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.macroId.message}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Category Name</label>
                <Input
                  {...form.register("name")}
                  placeholder="Enter category name"
                  disabled={!!category && isSystemCategory}
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>
            </>
          )}
          
          {/* Show read-only category name for system categories */}
          {category && isSystemCategory && (
            <div className="space-y-1">
              <label className="text-sm font-medium">Category Name</label>
              <Input
                value={category?.name || ""}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                System categories cannot be renamed. You can only add subcategories.
              </p>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium">Subcategories</label>
            
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto rounded-[12px] border p-2">
              {/* Show pending subcategories (before category is created) */}
              {pendingSubcategories.map((pending) => (
                <div
                  key={pending.tempId}
                  className="group relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-muted/50 hover:bg-muted border border-transparent hover:border-border transition-colors"
                >
                  {editingPendingSubcategoryTempId === pending.tempId ? (
                    <div className="flex items-center gap-1.5">
                      <Input
                        value={editingSubcategoryName}
                        onChange={(e) => setEditingSubcategoryName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleUpdatePendingSubcategory(pending.tempId);
                          } else if (e.key === "Escape") {
                            cancelEditingSubcategory();
                          }
                        }}
                        className="h-7 w-24 text-xs"
                        autoFocus
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => handleUpdatePendingSubcategory(pending.tempId)}
                        disabled={!editingSubcategoryName.trim()}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={cancelEditingSubcategory}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="text-xs font-medium text-foreground">{pending.name}</span>
                      <span className="text-xs text-muted-foreground px-1">Pending</span>
                      <div className="flex items-center gap-0.5">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => startEditingPendingSubcategory(pending)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5"
                          onClick={() => handleDeletePendingSubcategory(pending.tempId)}
                        >
                          <X className="h-3 w-3 text-black" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
              
              {/* Show created subcategories */}
              {subcategories.map((subcategory) => (
                <div
                  key={subcategory.id}
                  className="group relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-muted/50 hover:bg-muted border border-transparent hover:border-border transition-colors"
                >
                  {editingSubcategoryId === subcategory.id ? (
                    <div className="flex items-center gap-1.5">
                      <Input
                        value={editingSubcategoryName}
                        onChange={(e) => setEditingSubcategoryName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleUpdateSubcategory(subcategory.id);
                          } else if (e.key === "Escape") {
                            cancelEditingSubcategory();
                          }
                        }}
                        className="h-7 w-24 text-xs"
                        placeholder="Name"
                        autoFocus
                      />
                      <Input
                        value={editingSubcategoryLogo}
                        onChange={(e) => setEditingSubcategoryLogo(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleUpdateSubcategory(subcategory.id);
                          } else if (e.key === "Escape") {
                            cancelEditingSubcategory();
                          }
                        }}
                        className="h-7 w-32 text-xs"
                        placeholder="Logo URL"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => handleUpdateSubcategory(subcategory.id)}
                        disabled={isSubmittingSubcategory || !editingSubcategoryName.trim()}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={cancelEditingSubcategory}
                        disabled={isSubmittingSubcategory}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      {subcategory.logo && (
                        <img 
                          src={subcategory.logo} 
                          alt={subcategory.name}
                          className="h-4 w-4 object-contain rounded"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                      <span className="text-xs font-medium text-foreground">{subcategory.name}</span>
                      {/* Only show edit/delete buttons for user-created subcategories */}
                      {subcategory.userId !== null && subcategory.userId !== undefined && currentUserId && subcategory.userId === currentUserId && (
                        <div className="flex items-center gap-0.5">
                          {!isSystemCategory && (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => startEditingSubcategory(subcategory)}
                              disabled={isSubmittingSubcategory}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-5 w-5"
                            onClick={() => handleDeleteSubcategory(subcategory.id)}
                            disabled={isSubmittingSubcategory || deletingSubcategoryId === subcategory.id}
                          >
                            {deletingSubcategoryId === subcategory.id ? (
                              <Loader2 className="h-3 w-3 animate-spin text-black" />
                            ) : (
                              <X className="h-3 w-3 text-black" />
                            )}
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
              
              {/* Add new subcategory button/input - always at the end */}
              {isAddingSubcategory ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-border bg-background">
                  <Input
                    placeholder="Name"
                    value={newSubcategoryName}
                    onChange={(e) => setNewSubcategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddSubcategory();
                      } else if (e.key === "Escape") {
                        setIsAddingSubcategory(false);
                        setNewSubcategoryName("");
                        setNewSubcategoryLogo("");
                      }
                    }}
                    className="h-7 w-24 text-xs border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    autoFocus
                  />
                  <Input
                    placeholder="Logo URL (optional)"
                    value={newSubcategoryLogo}
                    onChange={(e) => setNewSubcategoryLogo(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddSubcategory();
                      } else if (e.key === "Escape") {
                        setIsAddingSubcategory(false);
                        setNewSubcategoryName("");
                        setNewSubcategoryLogo("");
                      }
                    }}
                    className="h-7 w-32 text-xs border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={handleAddSubcategory}
                    disabled={isSubmittingSubcategory || !newSubcategoryName.trim()}
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => {
                      setIsAddingSubcategory(false);
                      setNewSubcategoryName("");
                      setNewSubcategoryLogo("");
                    }}
                    disabled={isSubmittingSubcategory}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="small"
                  onClick={() => {
                    setIsAddingSubcategory(true);
                    setNewSubcategoryName("");
                  }}
                  disabled={isSubmittingSubcategory}
                  className="inline-flex items-center gap-1 rounded-full border-dashed"
                >
                  <Plus className="h-3 w-3" />
                  Add
                </Button>
              )}
            </div>
          </div>

          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
              }}
              disabled={isSubmitting || isSubmittingSubcategory}
            >
              Cancel
            </Button>
            {!currentCategoryId && !isSystemCategory && (
              <Button type="submit" disabled={isSubmitting || !form.watch("name") || !form.watch("macroId")}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Create"
                )}
              </Button>
            )}
            {currentCategoryId && category && !isSystemCategory && (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Update"
                )}
              </Button>
            )}
            {isSystemCategory && category && (
              <Button type="submit" disabled={isSubmitting || isSubmittingSubcategory}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

