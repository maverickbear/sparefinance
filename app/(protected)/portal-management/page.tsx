"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SimpleTabs, SimpleTabsContent, SimpleTabsList, SimpleTabsTrigger } from "@/components/ui/simple-tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UsersTable } from "@/components/admin/users-table";
import { PromoCodesTable } from "@/components/admin/promo-codes-table";
import { PromoCodeDialog } from "@/components/admin/promo-code-dialog";
import { UnifiedEntitiesTable } from "@/components/admin/unified-entities-table";
import { GroupDialog } from "@/components/admin/group-dialog";
import { CategoryDialog } from "@/components/admin/category-dialog";
import { SubcategoryDialog } from "@/components/admin/subcategory-dialog";
import { BulkImportDialog } from "@/components/admin/bulk-import-dialog";
import { Plus, Loader2, Users, Tag, FolderTree, BarChart3, Mail, MessageSquare, Star, Upload, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AdminUser, PromoCode, SystemGroup, SystemCategory, SystemSubcategory } from "@/lib/api/admin";
import { PageHeader } from "@/components/common/page-header";
import { DashboardOverview } from "@/components/admin/dashboard-overview";
import { FinancialOverview } from "@/components/admin/financial-overview";
import { ContactFormsTable, ContactForm } from "@/components/admin/contact-forms-table";
import { FeedbackTable, Feedback } from "@/components/admin/feedback-table";

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
  
  // Contact forms state
  const [contactForms, setContactForms] = useState<ContactForm[]>([]);
  const [loadingContactForms, setLoadingContactForms] = useState(false);
  
  // Feedback state
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loadingFeedbacks, setLoadingFeedbacks] = useState(false);
  const [feedbackMetrics, setFeedbackMetrics] = useState<{
    total: number;
    averageRating: number;
    ratingDistribution: { [key: number]: number };
  } | null>(null);
  
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
  const [isBulkImportDialogOpen, setIsBulkImportDialogOpen] = useState(false);

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
      loadContactForms();
      loadFeedbacks();
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

  async function loadContactForms() {
    try {
      setLoadingContactForms(true);
      const response = await fetch("/api/admin/contact-forms");
      if (!response.ok) {
        throw new Error("Failed to load contact forms");
      }
      const data = await response.json();
      setContactForms(data.contactForms || []);
    } catch (error) {
      console.error("Error loading contact forms:", error);
    } finally {
      setLoadingContactForms(false);
    }
  }

  async function loadFeedbacks() {
    try {
      setLoadingFeedbacks(true);
      const response = await fetch("/api/admin/feedback");
      if (!response.ok) {
        throw new Error("Failed to load feedbacks");
      }
      const data = await response.json();
      setFeedbacks(data.feedbacks || []);
      setFeedbackMetrics(data.metrics || null);
    } catch (error) {
      console.error("Error loading feedbacks:", error);
    } finally {
      setLoadingFeedbacks(false);
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
          <SimpleTabsTrigger value="contact-forms" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Contact Forms
          </SimpleTabsTrigger>
          <SimpleTabsTrigger value="feedback" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Feedback
          </SimpleTabsTrigger>
        </SimpleTabsList>

        <SimpleTabsContent value="dashboard" className="space-y-6">
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight">System Overview</h2>
              <p className="text-sm text-muted-foreground">
                Key metrics and statistics about the platform
              </p>
            </div>
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

            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight">Financial Overview</h2>
              <p className="text-sm text-muted-foreground">
                Revenue metrics, MRR, and future revenue projections
              </p>
            </div>
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
          </div>
        </SimpleTabsContent>

        <SimpleTabsContent value="users" className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">All Users</h2>
            <p className="text-sm text-muted-foreground">
              View and manage all registered users on the platform.
            </p>
          </div>
          <UsersTable users={users} loading={loading} />
        </SimpleTabsContent>

        <SimpleTabsContent value="promo-codes" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight">Promo Codes</h2>
              <p className="text-sm text-muted-foreground">
                Create and manage promotional codes for discounts on subscriptions.
              </p>
            </div>
            <Button onClick={handleCreatePromoCode}>
              <Plus className="h-4 w-4 mr-2" />
              Create Promo Code
            </Button>
          </div>
          <PromoCodesTable
            promoCodes={promoCodes}
            loading={false}
            onEdit={handleEditPromoCode}
            onDelete={handleDeletePromoCode}
            onToggleActive={handleTogglePromoCodeActive}
          />
        </SimpleTabsContent>

        <SimpleTabsContent value="system-entities" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                  <CardTitle>System Entities</CardTitle>
                      <CardDescription>
                    Manage system groups, categories, and subcategories. Click the expand icons to see categories and subcategories.
                      </CardDescription>
                    </div>
                <div className="flex items-center gap-2">
                  <Button onClick={() => setIsBulkImportDialogOpen(true)} variant="outline">
                    <Upload className="h-4 w-4 mr-2" />
                    Bulk Import
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button>
                      <Plus className="h-4 w-4 mr-2" />
                        Create
                        <ChevronDown className="h-4 w-4 ml-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleCreateGroup}>
                        <FolderTree className="h-4 w-4 mr-2" />
                      Create Group
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleCreateCategory}>
                        <Tag className="h-4 w-4 mr-2" />
                        Create Category
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleCreateSubcategory}>
                        <Tag className="h-4 w-4 mr-2" />
                        Create Subcategory
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                  </div>
                </CardHeader>
                <CardContent>
              <UnifiedEntitiesTable
                    groups={groups}
                    categories={categories}
                subcategories={subcategories}
                    loading={loadingSystemEntities}
                onEditGroup={handleEditGroup}
                onDeleteGroup={handleDeleteGroup}
                onEditCategory={handleEditCategory}
                onDeleteCategory={handleDeleteCategory}
                onEditSubcategory={handleEditSubcategory}
                onDeleteSubcategory={handleDeleteSubcategory}
                  />
                </CardContent>
              </Card>
        </SimpleTabsContent>

        <SimpleTabsContent value="contact-forms" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contact Forms</CardTitle>
              <CardDescription>
                View and manage contact form submissions from users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ContactFormsTable
                contactForms={contactForms}
                loading={loadingContactForms}
                onUpdate={loadContactForms}
              />
            </CardContent>
          </Card>
        </SimpleTabsContent>

        <SimpleTabsContent value="feedback" className="space-y-4">
          {feedbackMetrics && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Feedback</CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{feedbackMetrics.total}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
                  <Star className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {feedbackMetrics.averageRating.toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground">out of 5.0</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">5 Star Ratings</CardTitle>
                  <Star className="h-4 w-4 text-yellow-400 fill-current" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {feedbackMetrics.ratingDistribution[5] || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {feedbackMetrics.total > 0
                      ? `${((feedbackMetrics.ratingDistribution[5] || 0) / feedbackMetrics.total * 100).toFixed(1)}%`
                      : "0%"} of total
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Low Ratings (1-2)</CardTitle>
                  <Star className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(feedbackMetrics.ratingDistribution[1] || 0) + (feedbackMetrics.ratingDistribution[2] || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {feedbackMetrics.total > 0
                      ? `${(((feedbackMetrics.ratingDistribution[1] || 0) + (feedbackMetrics.ratingDistribution[2] || 0)) / feedbackMetrics.total * 100).toFixed(1)}%`
                      : "0%"} of total
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Rating Distribution</CardTitle>
              <CardDescription>
                Breakdown of feedback by rating
              </CardDescription>
            </CardHeader>
            <CardContent>
              {feedbackMetrics ? (
                <div className="space-y-3">
                  {[5, 4, 3, 2, 1].map((rating) => {
                    const count = feedbackMetrics.ratingDistribution[rating] || 0;
                    const percentage = feedbackMetrics.total > 0
                      ? (count / feedbackMetrics.total) * 100
                      : 0;
                    return (
                      <div key={rating} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{rating} Star{rating !== 1 ? 's' : ''}</span>
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`h-3 w-3 ${
                                    star <= rating
                                      ? "text-yellow-400 fill-current"
                                      : "text-muted-foreground"
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                          <span className="text-muted-foreground">
                            {count} ({percentage.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>All Feedback</CardTitle>
              <CardDescription>
                View and manage feedback submissions from users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FeedbackTable
                feedbacks={feedbacks}
                loading={loadingFeedbacks}
              />
            </CardContent>
          </Card>
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

      <BulkImportDialog
        open={isBulkImportDialogOpen}
        onOpenChange={setIsBulkImportDialogOpen}
        onSuccess={() => {
          loadSystemEntities();
        }}
      />
    </div>
  );
}

