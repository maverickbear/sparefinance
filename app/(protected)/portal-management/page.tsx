"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { SimpleTabs, SimpleTabsContent, SimpleTabsList, SimpleTabsTrigger } from "@/components/ui/simple-tabs";
import { FixedTabsWrapper } from "@/components/common/fixed-tabs-wrapper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { UsersTable } from "@/components/admin/users-table";
import { PromoCodesTable } from "@/components/admin/promo-codes-table";
import { PromoCodeDialog } from "@/components/admin/promo-code-dialog";
import { UnifiedEntitiesTable } from "@/components/admin/unified-entities-table";
import { GroupDialog } from "@/components/admin/group-dialog";
import { CategoryDialog } from "@/components/admin/category-dialog";
import { SubcategoryDialog } from "@/components/admin/subcategory-dialog";
import { BulkImportDialog } from "@/components/admin/bulk-import-dialog";
import { Plus, Loader2, Users, Tag, FolderTree, BarChart3, Mail, Star, Upload, ChevronDown, Search } from "lucide-react";
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
import { PlansTable } from "@/components/admin/plans-table";
import { PlanDialog } from "@/components/admin/plan-dialog";
import type { Plan } from "@/lib/validations/plan";
import { CreditCard } from "lucide-react";
import { SubscriptionDialog } from "@/components/admin/subscription-dialog";
import { BlockUserDialog } from "@/components/admin/block-user-dialog";
import { UnblockUserDialog } from "@/components/admin/unblock-user-dialog";

export default function PortalManagementPage() {
  const router = useRouter();
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState("");
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
  const [searchTerm, setSearchTerm] = useState("");
  
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
  
  // Plans state
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  
  // Subscription dialog state
  const [isSubscriptionDialogOpen, setIsSubscriptionDialogOpen] = useState(false);
  const [subscriptionUser, setSubscriptionUser] = useState<AdminUser | null>(null);
  
  // Block user dialog state
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [blockUser, setBlockUser] = useState<AdminUser | null>(null);
  
  // Unblock user dialog state
  const [isUnblockDialogOpen, setIsUnblockDialogOpen] = useState(false);
  const [unblockUser, setUnblockUser] = useState<AdminUser | null>(null);
  
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

  const [activeTab, setActiveTab] = useState<string>("dashboard");

  useEffect(() => {
    if (isSuperAdmin) {
      // Load initial data (dashboard is default tab)
      loadDashboard();
      
      // Load other data that's always needed
      Promise.all([
        loadUsers(),
        loadPromoCodes(),
        loadPlans(),
        loadSystemEntities(),
        loadContactForms(),
        loadFeedbacks(),
      ]).catch((error) => {
        console.error("Error loading portal data:", error);
      });
    }
  }, [isSuperAdmin]);

    // Lazy load data when tab changes
  useEffect(() => {
    if (!isSuperAdmin) return;
    
    if (activeTab === "plans" && plans.length === 0 && !loadingPlans) {
      loadAdminPlans();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isSuperAdmin]);

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
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || "Failed to load users";
        console.error("Error loading users:", errorMessage);
        setUsers([]);
        return;
      }
      const data = await response.json();
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch (error) {
      console.error("Error loading users:", error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadPromoCodes() {
    try {
      const response = await fetch("/api/admin/promo-codes");
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || "Failed to load promo codes";
        console.error("Error loading promo codes:", errorMessage);
        setPromoCodes([]);
        return;
      }
      const data = await response.json();
      setPromoCodes(Array.isArray(data.promoCodes) ? data.promoCodes : []);
    } catch (error) {
      console.error("Error loading promo codes:", error);
      setPromoCodes([]);
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

  async function loadAdminPlans() {
    try {
      setLoadingPlans(true);
      const response = await fetch("/api/admin/plans");
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || "Failed to load plans";
        console.error("Error loading plans:", errorMessage);
        setPlans([]);
        return;
      }
      const data = await response.json();
      setPlans(Array.isArray(data.plans) ? data.plans : []);
    } catch (error) {
      console.error("Error loading plans:", error);
      setPlans([]);
    } finally {
      setLoadingPlans(false);
    }
  }

  function handleEditPlan(plan: Plan) {
    setEditingPlan(plan);
    setIsPlanDialogOpen(true);
  }

  function handleManageSubscription(user: AdminUser) {
    if (!user.subscription || !user.subscription.stripeSubscriptionId) {
      console.error("User does not have a valid subscription");
      return;
    }
    setSubscriptionUser(user);
    setIsSubscriptionDialogOpen(true);
  }

  function handleBlockUser(user: AdminUser) {
    setBlockUser(user);
    setIsBlockDialogOpen(true);
  }

  function handleUnblockUser(user: AdminUser) {
    setUnblockUser(user);
    setIsUnblockDialogOpen(true);
  }

  function handleSuccess() {
    loadUsers(); // Refresh users to show updated info
    loadDashboard(); // Refresh dashboard to update metrics
  }

  async function loadDashboard() {
    try {
      setLoadingDashboard(true);
      const response = await fetch("/api/admin/dashboard");
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || "Failed to load dashboard data";
        console.error("Error loading dashboard:", errorMessage);
        setDashboardData(null);
        return;
      }
      const data = await response.json();
      setDashboardData(data);
    } catch (error) {
      console.error("Error loading dashboard:", error);
      setDashboardData(null);
    } finally {
      setLoadingDashboard(false);
    }
  }

  async function loadContactForms() {
    try {
      setLoadingContactForms(true);
      const response = await fetch("/api/admin/contact-forms");
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || "Failed to load contact forms";
        console.error("Error loading contact forms:", errorMessage);
        setContactForms([]);
        return;
      }
      const data = await response.json();
      setContactForms(Array.isArray(data.contactForms) ? data.contactForms : []);
    } catch (error) {
      console.error("Error loading contact forms:", error);
      setContactForms([]);
    } finally {
      setLoadingContactForms(false);
    }
  }

  async function loadFeedbacks() {
    try {
      setLoadingFeedbacks(true);
      const response = await fetch("/api/admin/feedback");
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || "Failed to load feedbacks";
        console.error("Error loading feedbacks:", errorMessage);
        setFeedbacks([]);
        setFeedbackMetrics(null);
        return;
      }
      const data = await response.json();
      setFeedbacks(Array.isArray(data.feedbacks) ? data.feedbacks : []);
      setFeedbackMetrics(data.metrics || null);
    } catch (error) {
      console.error("Error loading feedbacks:", error);
      setFeedbacks([]);
      setFeedbackMetrics(null);
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
        setGroups(Array.isArray(groupsData) ? groupsData : []);
      } else {
        const errorData = await groupsRes.json().catch(() => ({}));
        console.error("Error loading groups:", errorData.error || "Failed to load groups");
      }

      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      } else {
        const errorData = await categoriesRes.json().catch(() => ({}));
        console.error("Error loading categories:", errorData.error || "Failed to load categories");
      }

      if (subcategoriesRes.ok) {
        const subcategoriesData = await subcategoriesRes.json();
        setSubcategories(Array.isArray(subcategoriesData) ? subcategoriesData : []);
      } else {
        const errorData = await subcategoriesRes.json().catch(() => ({}));
        console.error("Error loading subcategories:", errorData.error || "Failed to load subcategories");
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

  // Filter system entities based on search term
  const filteredEntities = useMemo(() => {
    if (!searchTerm.trim()) {
      return { groups, categories, subcategories };
    }

    const searchLower = searchTerm.toLowerCase().trim();

    // Find matching subcategories
    const matchingSubcategoryIds = new Set<string>();
    const matchingCategoryIds = new Set<string>();
    const matchingGroupIds = new Set<string>();

    subcategories.forEach((subcategory) => {
      if (subcategory.name.toLowerCase().includes(searchLower)) {
        matchingSubcategoryIds.add(subcategory.id);
        matchingCategoryIds.add(subcategory.categoryId);
      }
    });

    // Find matching categories
    categories.forEach((category) => {
      if (category.name.toLowerCase().includes(searchLower)) {
        matchingCategoryIds.add(category.id);
        matchingGroupIds.add(category.macroId);
      }
    });

    // Find matching groups
    groups.forEach((group) => {
      if (group.name.toLowerCase().includes(searchLower)) {
        matchingGroupIds.add(group.id);
      }
    });

    // If a category matches, include its group
    categories.forEach((category) => {
      if (matchingCategoryIds.has(category.id)) {
        matchingGroupIds.add(category.macroId);
      }
    });

    // Filter groups
    const filteredGroups = groups.filter((group) => matchingGroupIds.has(group.id));

    // Filter categories (include if group matches or category matches)
    const filteredCategories = categories.filter(
      (category) => matchingGroupIds.has(category.macroId) || matchingCategoryIds.has(category.id)
    );

    // Filter subcategories (include if category matches or subcategory matches)
    const filteredSubcategories = subcategories.filter(
      (subcategory) => matchingCategoryIds.has(subcategory.categoryId) || matchingSubcategoryIds.has(subcategory.id)
    );

    return {
      groups: filteredGroups,
      categories: filteredCategories,
      subcategories: filteredSubcategories,
    };
  }, [searchTerm, groups, categories, subcategories]);

  if (isSuperAdmin === null) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null; // Will redirect
  }

  return (
    <SimpleTabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <PageHeader
          title="Portal Management"
        />

      {/* Fixed Tabs - Desktop only */}
      <FixedTabsWrapper>
        <SimpleTabsList>
          <SimpleTabsTrigger value="dashboard">
            Dashboard
          </SimpleTabsTrigger>
          <SimpleTabsTrigger value="users">
            Users
          </SimpleTabsTrigger>
          <SimpleTabsTrigger value="promo-codes">
            Promo Codes
          </SimpleTabsTrigger>
          <SimpleTabsTrigger value="system-entities">
            System Entities
          </SimpleTabsTrigger>
          <SimpleTabsTrigger value="contact-forms">
            Contact Forms
          </SimpleTabsTrigger>
          <SimpleTabsTrigger value="feedback">
            Feedback
          </SimpleTabsTrigger>
          <SimpleTabsTrigger value="plans">
            Plans
          </SimpleTabsTrigger>
        </SimpleTabsList>
      </FixedTabsWrapper>

        {/* Mobile/Tablet Tabs - Sticky at top */}
      <div 
          className="lg:hidden sticky top-0 z-40 bg-card border-b"
      >
        <div 
          className="overflow-x-auto scrollbar-hide" 
          style={{ 
            WebkitOverflowScrolling: 'touch',
            scrollSnapType: 'x mandatory',
            touchAction: 'pan-x',
          }}
        >
          <SimpleTabsList className="min-w-max px-4" style={{ scrollSnapAlign: 'start' }}>
            <SimpleTabsTrigger value="dashboard" className="flex-shrink-0 whitespace-nowrap">
              Dashboard
            </SimpleTabsTrigger>
            <SimpleTabsTrigger value="users" className="flex-shrink-0 whitespace-nowrap">
              Users
            </SimpleTabsTrigger>
            <SimpleTabsTrigger value="promo-codes" className="flex-shrink-0 whitespace-nowrap">
              Promo Codes
            </SimpleTabsTrigger>
            <SimpleTabsTrigger value="system-entities" className="flex-shrink-0 whitespace-nowrap">
              System Entities
            </SimpleTabsTrigger>
            <SimpleTabsTrigger value="contact-forms" className="flex-shrink-0 whitespace-nowrap">
              Contact Forms
            </SimpleTabsTrigger>
            <SimpleTabsTrigger value="feedback" className="flex-shrink-0 whitespace-nowrap">
              Feedback
            </SimpleTabsTrigger>
            <SimpleTabsTrigger value="plans" className="flex-shrink-0 whitespace-nowrap">
              Plans
            </SimpleTabsTrigger>
          </SimpleTabsList>
        </div>
      </div>

      <div className="w-full p-4 lg:p-8">
        <SimpleTabsContent value="dashboard">
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

        <SimpleTabsContent value="users">
          <div className="space-y-2 pb-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-semibold tracking-tight">All Users</h2>
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search users by email, name, or plan..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="pl-9"
                  size="medium"
                />
              </div>
            </div>
          </div>
          <UsersTable 
            users={users} 
            loading={loading} 
            searchQuery={userSearchQuery} 
            onSearchChange={setUserSearchQuery}
            onManageSubscription={handleManageSubscription}
            onBlockUser={handleBlockUser}
            onUnblockUser={handleUnblockUser}
          />
        </SimpleTabsContent>

        <SimpleTabsContent value="promo-codes">
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

        <SimpleTabsContent value="system-entities">
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
          </div>
          <div className="space-y-4">
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search groups, categories, or subcategories..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <UnifiedEntitiesTable
                    groups={filteredEntities.groups}
                    categories={filteredEntities.categories}
                subcategories={filteredEntities.subcategories}
                    loading={loadingSystemEntities}
                onEditGroup={handleEditGroup}
                onDeleteGroup={handleDeleteGroup}
                onEditCategory={handleEditCategory}
                onDeleteCategory={handleDeleteCategory}
                onEditSubcategory={handleEditSubcategory}
                onDeleteSubcategory={handleDeleteSubcategory}
                  />
              </div>
        </SimpleTabsContent>

        <SimpleTabsContent value="contact-forms">
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

        <SimpleTabsContent value="plans">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">Subscription Plans</h2>
            <p className="text-sm text-muted-foreground">
              Manage plan features, limits, and pricing. Changes will be synced to Stripe if configured.
            </p>
          </div>
          <PlansTable
            plans={plans}
            loading={loadingPlans}
            onEdit={handleEditPlan}
          />
        </SimpleTabsContent>

        <SimpleTabsContent value="feedback">
          <div className="space-y-6">
            {feedbackMetrics && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Feedback</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{feedbackMetrics.total}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
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
          </div>
        </SimpleTabsContent>

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
        availableCategories={categories.map((c) => ({ 
          id: c.id, 
          name: c.name,
          group: c.group ? { id: c.group.id, name: c.group.name } : null
        }))}
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

      <PlanDialog
        open={isPlanDialogOpen}
        onOpenChange={(open) => {
          setIsPlanDialogOpen(open);
          if (!open) {
            setEditingPlan(null);
          }
        }}
          plan={editingPlan}
        onSuccess={async () => {
          // Reload plans to show updated data
          await loadAdminPlans();
        }}
      />

      <SubscriptionDialog
        user={subscriptionUser}
        open={isSubscriptionDialogOpen}
        onOpenChange={(open) => {
          setIsSubscriptionDialogOpen(open);
          if (!open) {
            setSubscriptionUser(null);
          }
        }}
        onSuccess={handleSuccess}
      />

      <BlockUserDialog
        user={blockUser}
        open={isBlockDialogOpen}
        onOpenChange={(open) => {
          setIsBlockDialogOpen(open);
          if (!open) {
            setBlockUser(null);
          }
        }}
        onSuccess={handleSuccess}
      />

      <UnblockUserDialog
        user={unblockUser}
        open={isUnblockDialogOpen}
        onOpenChange={(open) => {
          setIsUnblockDialogOpen(open);
          if (!open) {
            setUnblockUser(null);
          }
        }}
        onSuccess={handleSuccess}
      />
      </div>
    </SimpleTabs>
  );
}

