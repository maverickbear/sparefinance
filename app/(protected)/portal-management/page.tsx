"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UsersTable } from "@/components/admin/users-table";
import { PromoCodesTable } from "@/components/admin/promo-codes-table";
import { PromoCodeDialog } from "@/components/admin/promo-code-dialog";
import { MacrosTable } from "@/components/admin/macros-table";
import { MacroDialog } from "@/components/admin/macro-dialog";
import { CategoriesTable } from "@/components/admin/categories-table";
import { CategoryDialog } from "@/components/admin/category-dialog";
import { SubcategoriesTable } from "@/components/admin/subcategories-table";
import { SubcategoryDialog } from "@/components/admin/subcategory-dialog";
import { Plus, Loader2, Users, Tag, FolderTree } from "lucide-react";
import type { AdminUser, PromoCode, SystemMacro, SystemCategory, SystemSubcategory } from "@/lib/api/admin";

export default function PortalManagementPage() {
  const router = useRouter();
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPromoCode, setEditingPromoCode] = useState<PromoCode | null>(null);
  const [availablePlans, setAvailablePlans] = useState<{ id: string; name: string }[]>([]);
  
  // System entities state
  const [macros, setMacros] = useState<SystemMacro[]>([]);
  const [categories, setCategories] = useState<SystemCategory[]>([]);
  const [subcategories, setSubcategories] = useState<SystemSubcategory[]>([]);
  const [loadingSystemEntities, setLoadingSystemEntities] = useState(false);
  
  // Dialog states
  const [isMacroDialogOpen, setIsMacroDialogOpen] = useState(false);
  const [editingMacro, setEditingMacro] = useState<SystemMacro | null>(null);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<SystemCategory | null>(null);
  const [isSubcategoryDialogOpen, setIsSubcategoryDialogOpen] = useState(false);
  const [editingSubcategory, setEditingSubcategory] = useState<SystemSubcategory | null>(null);

  useEffect(() => {
    checkSuperAdmin();
  }, []);

  useEffect(() => {
    if (isSuperAdmin) {
      loadUsers();
      loadPromoCodes();
      loadPlans();
      loadSystemEntities();
    }
  }, [isSuperAdmin]);

  async function checkSuperAdmin() {
    try {
      const { getUserRoleClient } = await import("@/lib/api/members-client");
      const role = await getUserRoleClient();
      if (role !== "super_admin") {
        router.push("/dashboard");
        return;
      }
      setIsSuperAdmin(true);
    } catch (error) {
      console.error("Error checking super_admin status:", error);
      router.push("/dashboard");
    }
  }

  async function loadUsers() {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/users");
      if (!response.ok) {
        throw new Error("Failed to load users");
      }
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error("Error loading users:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadPromoCodes() {
    try {
      const response = await fetch("/api/admin/promo-codes");
      if (!response.ok) {
        throw new Error("Failed to load promo codes");
      }
      const data = await response.json();
      setPromoCodes(data.promoCodes || []);
    } catch (error) {
      console.error("Error loading promo codes:", error);
    }
  }

  async function loadPlans() {
    try {
      const response = await fetch("/api/billing/plans");
      if (response.ok) {
        const data = await response.json();
        setAvailablePlans(
          (data.plans || []).map((plan: any) => ({
            id: plan.id,
            name: plan.name,
          }))
        );
      }
    } catch (error) {
      console.error("Error loading plans:", error);
    }
  }

  function handleCreatePromoCode() {
    setEditingPromoCode(null);
    setIsDialogOpen(true);
  }

  function handleEditPromoCode(promoCode: PromoCode) {
    setEditingPromoCode(promoCode);
    setIsDialogOpen(true);
  }

  async function handleDeletePromoCode(id: string) {
    const response = await fetch(`/api/admin/promo-codes?id=${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete promo code");
    }

    await loadPromoCodes();
  }

  async function handleTogglePromoCodeActive(id: string, isActive: boolean) {
    const response = await fetch("/api/admin/promo-codes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        isActive: !isActive,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to toggle promo code");
    }

    await loadPromoCodes();
  }

  // System entities functions
  async function loadSystemEntities() {
    try {
      setLoadingSystemEntities(true);
      const [macrosRes, categoriesRes, subcategoriesRes] = await Promise.all([
        fetch("/api/admin/macros"),
        fetch("/api/admin/categories"),
        fetch("/api/admin/subcategories"),
      ]);

      if (macrosRes.ok) {
        const macrosData = await macrosRes.json();
        setMacros(macrosData || []);
      }

      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        setCategories(categoriesData || []);
      }

      if (subcategoriesRes.ok) {
        const subcategoriesData = await subcategoriesRes.json();
        setSubcategories(subcategoriesData || []);
      }
    } catch (error) {
      console.error("Error loading system entities:", error);
    } finally {
      setLoadingSystemEntities(false);
    }
  }

  function handleCreateMacro() {
    setEditingMacro(null);
    setIsMacroDialogOpen(true);
  }

  function handleEditMacro(macro: SystemMacro) {
    setEditingMacro(macro);
    setIsMacroDialogOpen(true);
  }

  async function handleDeleteMacro(id: string) {
    const response = await fetch(`/api/admin/macros?id=${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete macro");
    }

    await loadSystemEntities();
  }

  function handleCreateCategory() {
    setEditingCategory(null);
    setIsCategoryDialogOpen(true);
  }

  function handleEditCategory(category: SystemCategory) {
    setEditingCategory(category);
    setIsCategoryDialogOpen(true);
  }

  async function handleDeleteCategory(id: string) {
    const response = await fetch(`/api/admin/categories?id=${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete category");
    }

    await loadSystemEntities();
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
    const response = await fetch(`/api/admin/subcategories?id=${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete subcategory");
    }

    await loadSystemEntities();
  }

  if (isSuperAdmin === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null; // Will redirect
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="space-y-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Portal Management</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Manage users, promotional codes, and system entities (macros, categories, subcategories) for the platform.
          </p>
        </div>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="promo-codes" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Promo Codes
          </TabsTrigger>
          <TabsTrigger value="system-entities" className="flex items-center gap-2">
            <FolderTree className="h-4 w-4" />
            System Entities
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Users</CardTitle>
              <CardDescription>
                View and manage all registered users on the platform.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UsersTable users={users} loading={loading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="promo-codes" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Promo Codes</CardTitle>
                  <CardDescription>
                    Create and manage promotional codes for discounts on subscriptions.
                  </CardDescription>
                </div>
                <Button onClick={handleCreatePromoCode}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Promo Code
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <PromoCodesTable
                promoCodes={promoCodes}
                loading={false}
                onEdit={handleEditPromoCode}
                onDelete={handleDeletePromoCode}
                onToggleActive={handleTogglePromoCodeActive}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system-entities" className="space-y-4">
          <Tabs defaultValue="macros" className="space-y-4">
            <TabsList>
              <TabsTrigger value="macros">Macros</TabsTrigger>
              <TabsTrigger value="categories">Categories</TabsTrigger>
              <TabsTrigger value="subcategories">Subcategories</TabsTrigger>
            </TabsList>

            <TabsContent value="macros" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>System Macros</CardTitle>
                      <CardDescription>
                        Manage system macros that are available to all users.
                      </CardDescription>
                    </div>
                    <Button onClick={handleCreateMacro}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Macro
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <MacrosTable
                    macros={macros}
                    loading={loadingSystemEntities}
                    onEdit={handleEditMacro}
                    onDelete={handleDeleteMacro}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="categories" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>System Categories</CardTitle>
                      <CardDescription>
                        Manage system categories that are available to all users.
                      </CardDescription>
                    </div>
                    <Button onClick={handleCreateCategory}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Category
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <CategoriesTable
                    categories={categories}
                    macros={macros.map((m) => ({ id: m.id, name: m.name }))}
                    loading={loadingSystemEntities}
                    onEdit={handleEditCategory}
                    onDelete={handleDeleteCategory}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="subcategories" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>System Subcategories</CardTitle>
                      <CardDescription>
                        Manage system subcategories that are available to all users.
                      </CardDescription>
                    </div>
                    <Button onClick={handleCreateSubcategory}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Subcategory
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <SubcategoriesTable
                    subcategories={subcategories}
                    categories={categories.map((c) => ({ id: c.id, name: c.name }))}
                    loading={loadingSystemEntities}
                    onEdit={handleEditSubcategory}
                    onDelete={handleDeleteSubcategory}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      <PromoCodeDialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingPromoCode(null);
          }
        }}
        promoCode={editingPromoCode}
        onSuccess={() => {
          loadPromoCodes();
        }}
        availablePlans={availablePlans}
      />

      <MacroDialog
        open={isMacroDialogOpen}
        onOpenChange={(open) => {
          setIsMacroDialogOpen(open);
          if (!open) {
            setEditingMacro(null);
          }
        }}
        macro={editingMacro}
        onSuccess={() => {
          loadSystemEntities();
        }}
      />

      <CategoryDialog
        open={isCategoryDialogOpen}
        onOpenChange={(open) => {
          setIsCategoryDialogOpen(open);
          if (!open) {
            setEditingCategory(null);
          }
        }}
        category={editingCategory}
        availableMacros={macros.map((m) => ({ id: m.id, name: m.name }))}
        onSuccess={() => {
          loadSystemEntities();
        }}
      />

      <SubcategoryDialog
        open={isSubcategoryDialogOpen}
        onOpenChange={(open) => {
          setIsSubcategoryDialogOpen(open);
          if (!open) {
            setEditingSubcategory(null);
          }
        }}
        subcategory={editingSubcategory}
        availableCategories={categories.map((c) => ({ id: c.id, name: c.name }))}
        onSuccess={() => {
          loadSystemEntities();
        }}
      />
    </div>
  );
}

