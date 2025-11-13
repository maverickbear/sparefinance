"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SimpleTabs, SimpleTabsContent, SimpleTabsList, SimpleTabsTrigger } from "@/components/ui/simple-tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UsersTable } from "@/components/admin/users-table";
import { PromoCodesTable } from "@/components/admin/promo-codes-table";
import { PromoCodeDialog } from "@/components/admin/promo-code-dialog";
import { GroupsTable } from "@/components/admin/groups-table";
import { GroupDialog } from "@/components/admin/group-dialog";
import { CategoriesTable } from "@/components/admin/categories-table";
import { CategoryDialog } from "@/components/admin/category-dialog";
import { SubcategoriesTable } from "@/components/admin/subcategories-table";
import { SubcategoryDialog } from "@/components/admin/subcategory-dialog";
import { Plus, Loader2, Users, Tag, FolderTree, BarChart3 } from "lucide-react";
import type { AdminUser, PromoCode, SystemGroup, SystemCategory, SystemSubcategory } from "@/lib/api/admin";
import { PageHeader } from "@/components/common/page-header";
import { DashboardOverview } from "@/components/admin/dashboard-overview";
import { FinancialOverview } from "@/components/admin/financial-overview";

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
  const [groups, setGroups] = useState<SystemGroup[]>([]);
  const [categories, setCategories] = useState<SystemCategory[]>([]);
  const [subcategories, setSubcategories] = useState<SystemSubcategory[]>([]);
  const [loadingSystemEntities, setLoadingSystemEntities] = useState(false);
  
  // Dashboard state
  const [dashboardData, setDashboardData] = useState<{
    overview: any;
    financial: any;
    planDistribution: any[];
  } | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  
  // Dialog states
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<SystemGroup | null>(null);
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
      loadDashboard();
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

  async function loadDashboard() {
    try {
      setLoadingDashboard(true);
      const response = await fetch("/api/admin/dashboard");
      if (!response.ok) {
        throw new Error("Failed to load dashboard data");
      }
      const data = await response.json();
      setDashboardData(data);
    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setLoadingDashboard(false);
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
      const [groupsRes, categoriesRes, subcategoriesRes] = await Promise.all([
        fetch("/api/admin/groups"),
        fetch("/api/admin/categories"),
        fetch("/api/admin/subcategories"),
      ]);

      if (groupsRes.ok) {
        const groupsData = await groupsRes.json();
        setGroups(groupsData || []);
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

  function handleCreateGroup() {
    setEditingGroup(null);
    setIsGroupDialogOpen(true);
  }

  function handleEditGroup(group: SystemGroup) {
    setEditingGroup(group);
    setIsGroupDialogOpen(true);
  }

  async function handleDeleteGroup(id: string) {
    const response = await fetch(`/api/admin/groups?id=${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete group");
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
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Portal Management"
        description="Manage users, promotional codes, and system entities (groups, categories, subcategories) for the platform."
      />

      <SimpleTabs defaultValue="dashboard" className="space-y-4">
        <SimpleTabsList>
          <SimpleTabsTrigger value="dashboard" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </SimpleTabsTrigger>
          <SimpleTabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Users
          </SimpleTabsTrigger>
          <SimpleTabsTrigger value="promo-codes" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Promo Codes
          </SimpleTabsTrigger>
          <SimpleTabsTrigger value="system-entities" className="flex items-center gap-2">
            <FolderTree className="h-4 w-4" />
            System Entities
          </SimpleTabsTrigger>
        </SimpleTabsList>

        <SimpleTabsContent value="dashboard" className="space-y-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>System Overview</CardTitle>
                <CardDescription>
                  Key metrics and statistics about the platform
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DashboardOverview
                  overview={dashboardData?.overview || {
                    totalUsers: 0,
                    usersWithoutSubscription: 0,
                    totalSubscriptions: 0,
                    activeSubscriptions: 0,
                    trialingSubscriptions: 0,
                    cancelledSubscriptions: 0,
                    pastDueSubscriptions: 0,
                    churnRisk: 0,
                  }}
                  loading={loadingDashboard}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Financial Overview</CardTitle>
                <CardDescription>
                  Revenue metrics, MRR, and future revenue projections
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FinancialOverview
                  financial={dashboardData?.financial || {
                    mrr: 0,
                    estimatedFutureMRR: 0,
                    totalEstimatedMRR: 0,
                    subscriptionDetails: [],
                    upcomingTrials: [],
                  }}
                  loading={loadingDashboard}
                />
              </CardContent>
            </Card>
          </div>
        </SimpleTabsContent>

        <SimpleTabsContent value="users" className="space-y-4">
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
        </SimpleTabsContent>

        <SimpleTabsContent value="promo-codes" className="space-y-4">
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
        </SimpleTabsContent>

        <SimpleTabsContent value="system-entities" className="space-y-4">
          <SimpleTabs defaultValue="groups" className="space-y-4">
            <SimpleTabsList>
              <SimpleTabsTrigger value="groups">Groups</SimpleTabsTrigger>
              <SimpleTabsTrigger value="categories">Categories</SimpleTabsTrigger>
              <SimpleTabsTrigger value="subcategories">Subcategories</SimpleTabsTrigger>
            </SimpleTabsList>

            <SimpleTabsContent value="groups" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>System Groups</CardTitle>
                      <CardDescription>
                        Manage system groups that are available to all users.
                      </CardDescription>
                    </div>
                    <Button onClick={handleCreateGroup}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Group
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <GroupsTable
                    groups={groups}
                    loading={loadingSystemEntities}
                    onEdit={handleEditGroup}
                    onDelete={handleDeleteGroup}
                  />
                </CardContent>
              </Card>
            </SimpleTabsContent>

            <SimpleTabsContent value="categories" className="space-y-4">
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
                    macros={groups.map((g) => ({ id: g.id, name: g.name }))}
                    loading={loadingSystemEntities}
                    onEdit={handleEditCategory}
                    onDelete={handleDeleteCategory}
                  />
                </CardContent>
              </Card>
            </SimpleTabsContent>

            <SimpleTabsContent value="subcategories" className="space-y-4">
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
            </SimpleTabsContent>
          </SimpleTabs>
        </SimpleTabsContent>
      </SimpleTabs>

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

      <GroupDialog
        open={isGroupDialogOpen}
        onOpenChange={(open) => {
          setIsGroupDialogOpen(open);
          if (!open) {
            setEditingGroup(null);
          }
        }}
        group={editingGroup}
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
        availableMacros={groups.map((g) => ({ id: g.id, name: g.name }))}
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

