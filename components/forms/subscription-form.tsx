"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DollarAmountInput } from "@/components/common/dollar-amount-input";
import { formatTransactionDate, parseDateInput, formatDateInput } from "@/src/infrastructure/utils/timestamp";
import { useToast } from "@/components/toast-provider";
import { formatMoney } from "@/components/common/money";
import { DatePicker } from "@/components/ui/date-picker";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Plus, Check } from "lucide-react";
// Using API routes instead of client-side APIs
import type { Category } from "@/src/domain/categories/categories.types";
import type { Account } from "@/src/domain/accounts/accounts.types";
import type {
  UserServiceSubscription,
  UserServiceSubscriptionFormData,
} from "@/src/domain/subscriptions/subscriptions.types";

interface SubscriptionFormProps {
  subscription?: UserServiceSubscription;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function SubscriptionForm({
  subscription,
  open,
  onOpenChange,
  onSuccess,
}: SubscriptionFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Array<{ id: string; name: string; categoryId: string }>>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [isAddingNewSubcategory, setIsAddingNewSubcategory] = useState(false);
  const [newSubcategoryName, setNewSubcategoryName] = useState("");
  
  // New subscription services state
  const [subscriptionServiceCategories, setSubscriptionServiceCategories] = useState<any[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [availablePlans, setAvailablePlans] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(false);

  // Get all subcategories from Subscriptions group for Select
  const getSubscriptionsSubcategories = () => {
    // Filter categories to only include those from "Subscriptions" group
    const subscriptionsCategories = allCategories.filter((category) => {
      const groupName = category.group?.name?.toLowerCase() || "";
      return groupName === "subscriptions" || groupName === "subscription";
    });
    
    const allSubcategories: Array<{ id: string; name: string; categoryId: string; categoryName: string }> = [];
    
    subscriptionsCategories.forEach((category) => {
      if (category.subcategories && category.subcategories.length > 0) {
        category.subcategories.forEach((subcat) => {
          allSubcategories.push({
           id: subcat.id,
           name: subcat.name,
           categoryId: category.id,
            categoryName: category.name,
          });
        });
      }
    });
    
    return allSubcategories;
  };

  // Get categories with subcategories grouped for Select
  const getSubscriptionsCategoriesGrouped = () => {
    // Filter categories to only include those from "Subscriptions" group
    const subscriptionsCategories = allCategories.filter((category) => {
      const groupName = category.group?.name?.toLowerCase() || "";
      return groupName === "subscriptions" || groupName === "subscription";
    });
    
    return subscriptionsCategories
      .filter((category) => category.subcategories && category.subcategories.length > 0)
      .map((category) => ({
        id: category.id,
        name: category.name,
        subcategories: category.subcategories!.map((subcat) => ({
          id: subcat.id,
          name: subcat.name,
          categoryId: category.id,
        })),
      }));
  };

  // Get subscription categories from new table
  const getSubscriptionCategories = () => {
    return subscriptionServiceCategories.filter((cat) => cat.services.length > 0);
  };

  // Get filtered subcategories based on selected category filter
  const getFilteredSubcategories = () => {
    if (!selectedCategoryFilter) {
      return getSubscriptionsSubcategories();
    }
    
    return getSubscriptionsSubcategories().filter(
      (subcat) => subcat.categoryId === selectedCategoryFilter
    );
  };

  // Legacy function for backwards compatibility (if still used elsewhere)
  const getAllSubcategoriesGrouped = () => {
    const grouped: Record<string, { categoryName: string; subcategories: Array<{ id: string; name: string; categoryId: string }> }> = {};
    
    // Filter categories to only include those from "Subscriptions" group
    const subscriptionsCategories = allCategories.filter((category) => {
      const groupName = category.group?.name?.toLowerCase() || "";
      return groupName === "subscriptions" || groupName === "subscription";
    });
    
    subscriptionsCategories.forEach((category) => {
      if (category.subcategories && category.subcategories.length > 0) {
        if (!grouped[category.id]) {
          grouped[category.id] = {
            categoryName: category.name,
            subcategories: [],
          };
        }
        category.subcategories.forEach((subcat) => {
          grouped[category.id].subcategories.push({
            id: subcat.id,
            name: subcat.name,
            categoryId: category.id,
          });
        });
      }
    });
    
    return grouped;
  };
  const [billingFrequency, setBillingFrequency] = useState<"monthly" | "weekly" | "biweekly" | "semimonthly" | "daily">("monthly");

  const form = useForm<UserServiceSubscriptionFormData>({
    defaultValues: {
      serviceName: "",
      subcategoryId: null,
      amount: 0,
      description: "",
      billingFrequency: "monthly",
      accountId: "",
      firstBillingDate: new Date(),
      categoryId: null,
      newSubcategoryName: null,
      planId: null,
    },
  });

  // Watch billing frequency
  const watchedBillingFrequency = form.watch("billingFrequency");

  useEffect(() => {
    setBillingFrequency(watchedBillingFrequency);
  }, [watchedBillingFrequency]);

  // Load accounts, categories, and subscription services
  useEffect(() => {
    if (open) {
      loadAccounts();
      loadAllCategories();
      loadSubscriptionServices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, subscription]);

  async function loadSubscriptionServices() {
    try {
      const response = await fetch("/api/subscription-services");
      if (!response.ok) {
        throw new Error("Failed to fetch subscription services");
      }
      const data = await response.json();
      setSubscriptionServiceCategories(data.categories || []);
      
      // If editing and we have a service name, try to find and select the service
      if (subscription && subscription.serviceName && data.categories.length > 0) {
        const service = data.categories
          .flatMap((cat: any) => cat.services)
          .find((s: any) => s.name === subscription.serviceName);
        if (service) {
          setSelectedServiceId(service.id);
          loadPlansForService(service.id);
        }
      }
    } catch (error) {
      console.error("Error loading subscription services:", error);
    }
  }

  async function loadPlansForService(serviceId: string) {
    setLoadingPlans(true);
    setSelectedPlanId(null);
    try {
      const plansResponse = await fetch(
        `/api/subscription-services/plans?serviceId=${encodeURIComponent(serviceId)}`
      );
      if (!plansResponse.ok) {
        throw new Error("Failed to fetch subscription service plans");
      }
      const plansData = await plansResponse.json();
      const plans = plansData.plans || [];
      setAvailablePlans(plans);
      // Default to none selected - user must explicitly choose a plan
    } catch (error) {
      console.error("Error loading plans:", error);
      setAvailablePlans([]);
    } finally {
      setLoadingPlans(false);
    }
  }

  // Find or create subcategory for a service
  async function findOrCreateSubcategoryForService(serviceName: string, serviceLogo?: string | null) {
    // Find all Subscriptions categories
    const subscriptionsCategories = allCategories.filter((category) => {
      const groupName = category.group?.name?.toLowerCase() || "";
      return groupName === "subscriptions" || groupName === "subscription";
    });

    if (subscriptionsCategories.length === 0) {
      console.error("No Subscriptions category found");
      return null;
    }

    // First, try to find existing subcategory with the same name across all Subscriptions categories
    for (const category of subscriptionsCategories) {
      const existingSubcategory = category.subcategories?.find(
        (subcat) => subcat.name.toLowerCase() === serviceName.toLowerCase()
      );

      if (existingSubcategory) {
        return existingSubcategory.id;
      }
    }

    // If not found, create a new subcategory in the first Subscriptions category
    const category = subscriptionsCategories[0];
    
    try {
      const response = await fetch(`/api/categories/${category.id}/subcategories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: serviceName,
          logo: serviceLogo || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Error creating subcategory:", error);
        return null;
      }

      const newSubcategory = await response.json();
      
      // Reload categories to include the new subcategory
      await loadAllCategories();
      
      return newSubcategory.id;
    } catch (error) {
      console.error("Error creating subcategory:", error);
      return null;
    }
  }

  // Set category filter when editing and categories are loaded
  useEffect(() => {
    if (open && subscription && subscription.subcategoryId && allCategories.length > 0) {
      // Find the subcategory in the loaded categories
      const subscriptionsCategories = allCategories.filter((category) => {
        const groupName = category.group?.name?.toLowerCase() || "";
        return groupName === "subscriptions" || groupName === "subscription";
      });
      
      for (const category of subscriptionsCategories) {
        if (category.subcategories) {
          const subcategory = category.subcategories.find(
            (sub) => sub.id === subscription.subcategoryId
          );
          if (subcategory) {
            setSelectedCategoryFilter(category.id);
            break;
          }
        }
      }
    }
  }, [open, subscription, allCategories]);

  // Initialize form when editing
  useEffect(() => {
    if (open && subscription) {
      form.reset({
        serviceName: subscription.serviceName,
        subcategoryId: subscription.subcategoryId || null,
        planId: subscription.planId || null,
        amount: subscription.amount,
        description: subscription.description || "",
        billingFrequency: subscription.billingFrequency,
        accountId: subscription.accountId,
        firstBillingDate: subscription.firstBillingDate ? new Date(subscription.firstBillingDate) : new Date(),
        categoryId: null,
        newSubcategoryName: null,
      });
      setBillingFrequency(subscription.billingFrequency);
      setSelectedPlanId(subscription.planId || null);
      
      // Try to find the service by name and load plans
      // This will be handled in loadSubscriptionServices after categories are loaded
      
      // Load subcategory if exists
      if (subscription.subcategoryId) {
        loadSubcategoryInfo(subscription.subcategoryId);
      }
    } else if (open && !subscription) {
      form.reset({
        serviceName: "",
        subcategoryId: null,
        planId: null,
        amount: 0,
        description: "",
        billingFrequency: "monthly",
        accountId: accounts.length > 0 ? accounts[0].id : "",
        firstBillingDate: new Date(),
        categoryId: null,
        newSubcategoryName: null,
      });
      setBillingFrequency("monthly");
      setSelectedCategoryId("");
      setSelectedCategoryFilter(null);
      setSubcategories([]);
      setIsAddingNewSubcategory(false);
      setNewSubcategoryName("");
      setSelectedServiceId(null);
      setAvailablePlans([]);
      setSelectedPlanId(null);
    }
  }, [open, subscription, accounts.length]);

  async function loadAccounts() {
    try {
      const response = await fetch("/api/v2/accounts?includeHoldings=false");
      if (!response.ok) {
        throw new Error("Failed to fetch accounts");
      }
      const data = await response.json();
      setAccounts(data);
      if (data.length > 0 && !subscription) {
        form.setValue("accountId", data[0].id);
      }
    } catch (error) {
      console.error("Error loading accounts:", error);
      toast({
        title: "Error",
        description: "Failed to load accounts",
        variant: "destructive",
      });
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
      console.error("Error loading categories:", error);
    }
  }

  async function loadSubcategoryInfo(subcategoryId: string) {
    // Find subcategory in all categories
    for (const category of allCategories) {
      if (category.subcategories) {
        const subcategory = category.subcategories.find((sc) => sc.id === subcategoryId);
        if (subcategory) {
          setSelectedCategoryId(category.id);
          // No need to set subcategories anymore since we show all grouped
          return;
        }
      }
    }
    
    // If not found, try to fetch from API
    try {
      const res = await fetch(`/api/categories?categoryId=${selectedCategoryId || ""}`);
      if (res.ok) {
        const subcats = await res.json();
        const found = subcats.find((sc: any) => sc.id === subcategoryId);
        if (found) {
          setSelectedCategoryId(found.categoryId);
          // No need to set subcategories anymore since we show all grouped
        }
      }
    } catch (error) {
      console.error("Error loading subcategory:", error);
    }
  }

  function handleCategoryChange(categoryId: string) {
    setSelectedCategoryId(categoryId);
    form.setValue("categoryId", categoryId);
    form.setValue("subcategoryId", null);
    
    if (categoryId) {
      const category = allCategories.find((c) => c.id === categoryId);
      if (category && category.subcategories) {
        setSubcategories(category.subcategories.map((sc) => ({ ...sc, categoryId })));
      } else {
        loadSubcategoriesForCategory(categoryId);
      }
    } else {
      setSubcategories([]);
    }
  }

  async function loadSubcategoriesForCategory(categoryId: string) {
    try {
      const res = await fetch(`/api/categories?categoryId=${categoryId}`);
      if (res.ok) {
        const subcats = await res.json();
        setSubcategories(subcats.map((sc: any) => ({ ...sc, categoryId: sc.categoryId || categoryId })));
      } else {
        setSubcategories([]);
      }
    } catch (error) {
      console.error("Error loading subcategories:", error);
      setSubcategories([]);
    }
  }

  function handleCategoryFilterClick(categoryId: string | null) {
    setSelectedCategoryFilter(categoryId);
    
    // If no category is selected, clear service selection
    if (!categoryId) {
      setSelectedServiceId(null);
      form.setValue("serviceName", "");
      form.setValue("subcategoryId", null);
      setIsAddingNewSubcategory(false);
      setAvailablePlans([]);
      setSelectedPlanId(null);
      return;
    }
    
    // If a category is selected and current service doesn't belong to it, clear the selection
      const currentSubcategoryId = form.watch("subcategoryId");
      if (currentSubcategoryId) {
        const subcategories = getSubscriptionsSubcategories();
        const current = subcategories.find((sub) => sub.id === currentSubcategoryId);
        if (current && current.categoryId !== categoryId) {
          form.setValue("subcategoryId", null);
          form.setValue("serviceName", "");
          setSelectedCategoryId("");
      }
    }
    
    // Clear service selection if current service doesn't belong to selected category
    if (selectedServiceId) {
      const category = subscriptionServiceCategories.find(
        (cat) => cat.id === categoryId
      );
      const service = category?.services.find((s: any) => s.id === selectedServiceId);
      if (!service) {
        setSelectedServiceId(null);
        form.setValue("serviceName", "");
        setAvailablePlans([]);
        setSelectedPlanId(null);
      }
    }
  }

  function handleSelectChange(value: string) {
    if (value === "custom") {
      // User wants to create custom service name
      setIsAddingNewSubcategory(true);
      form.setValue("subcategoryId", null);
      form.setValue("serviceName", "");
      setSelectedCategoryId("");
    } else if (value) {
      // Selected an existing subcategory
      const subcategories = getSubscriptionsSubcategories();
      const selected = subcategories.find((sub) => sub.id === value);
      if (selected) {
        form.setValue("subcategoryId", selected.id);
        form.setValue("serviceName", selected.name);
        setSelectedCategoryId(selected.categoryId);
        setIsAddingNewSubcategory(false);
      }
    } else {
      // Cleared
      form.setValue("subcategoryId", null);
      form.setValue("serviceName", "");
      setSelectedCategoryId("");
      setIsAddingNewSubcategory(false);
    }
  }

  async function handleCreateNewSubcategory() {
    if (!newSubcategoryName.trim() || !selectedCategoryId) {
      toast({
        title: "Validation Error",
        description: "Please enter a subcategory name and select a category",
        variant: "destructive",
      });
      return;
    }

    try {
      const res = await fetch(`/api/categories/${selectedCategoryId}/subcategories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newSubcategoryName.trim() }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create subcategory");
      }

      const newSubcategory = await res.json();
      setSubcategories([...subcategories, { ...newSubcategory, categoryId: selectedCategoryId }]);
      form.setValue("subcategoryId", newSubcategory.id);
      form.setValue("serviceName", newSubcategory.name);
      setIsAddingNewSubcategory(false);
      setNewSubcategoryName("");
      
      toast({
        title: "Success",
        description: "Subcategory created successfully",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create subcategory",
        variant: "destructive",
      });
    }
  }

  async function onSubmit(data: UserServiceSubscriptionFormData) {
    try {
      setIsSubmitting(true);

      const formData: UserServiceSubscriptionFormData = {
        ...data,
        firstBillingDate: data.firstBillingDate instanceof Date 
          ? data.firstBillingDate 
          : new Date(data.firstBillingDate),
        categoryId: isAddingNewSubcategory && selectedCategoryId ? selectedCategoryId : null,
        newSubcategoryName: isAddingNewSubcategory ? newSubcategoryName.trim() : null,
      };

      // Save subscription
      let savedSubscription: UserServiceSubscription;
      if (subscription) {
        const response = await fetch(`/api/user-subscriptions/${subscription.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to update subscription");
        }
        savedSubscription = await response.json();
        toast({
          title: "Success",
          description: "Subscription updated successfully",
          variant: "success",
        });
      } else {
        const response = await fetch("/api/user-subscriptions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to create subscription");
        }
        savedSubscription = await response.json();
        toast({
          title: "Success",
          description: "Subscription created successfully",
          variant: "success",
        });
      }

      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save subscription",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl sm:max-h-[90vh] flex flex-col !p-0 !gap-0">
        <DialogHeader>
          <DialogTitle>
            {subscription ? "Edit Subscription" : "Create Subscription"}
          </DialogTitle>
          <DialogDescription>
            {subscription
              ? "Update your subscription details"
              : "Create a new subscription to track recurring payments"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {/* Service Name / Subcategory */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Subscription Category</label>
            <div className="flex flex-wrap gap-2">
              {getSubscriptionCategories().map((category) => (
                <Badge
                  key={category.id}
                  variant={selectedCategoryFilter === category.id ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => {
                    // Toggle: if already selected, deselect to show all
                    if (selectedCategoryFilter === category.id) {
                      handleCategoryFilterClick(null);
                    } else {
                      handleCategoryFilterClick(category.id);
                    }
                  }}
                >
                  {category.name}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Service Name</label>
            {!selectedCategoryFilter ? (
              <p className="text-sm text-muted-foreground">
                Please select a subscription category to view available services.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {/* Custom Service Card - Always First */}
                <Card
                  className={`cursor-pointer transition-all hover:border-primary w-[100px] h-[100px] flex items-center justify-center ${
                    isAddingNewSubcategory
                      ? "border-primary border-2 bg-primary/5"
                      : "border-border"
                  }`}
                  onClick={() => {
                  setSelectedServiceId(null);
                  form.setValue("serviceName", "");
                  form.setValue("subcategoryId", null);
                  setIsAddingNewSubcategory(true);
                    setAvailablePlans([]);
                    setSelectedPlanId(null);
                  }}
                >
                  <CardContent className="p-2 flex flex-col items-center justify-center h-full">
                    <div className="flex flex-col items-center gap-1 text-center">
                      {isAddingNewSubcategory && (
                        <Check className="h-4 w-4 text-primary mb-1" />
                      )}
                      <Plus className="h-5 w-5 text-muted-foreground mb-1" />
                      <span className="font-medium text-xs leading-tight text-muted-foreground">
                        Create New
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Service Cards */}
                {(() => {
                    const category = subscriptionServiceCategories.find(
                      (cat) => cat.id === selectedCategoryFilter
                    );
                  const servicesToShow = category
                    ? [...category.services].sort((a, b) => a.name.localeCompare(b.name))
                    : [];

                  return servicesToShow.map((service) => {
                    const isSelected = selectedServiceId === service.id;
                      return (
                      <Card
                        key={service.id}
                        className={`cursor-pointer transition-all hover:border-primary w-[100px] h-[100px] flex items-center justify-center ${
                          isSelected
                            ? "border-primary border-2 bg-primary/5"
                            : "border-border"
                        }`}
                        onClick={async () => {
                          setSelectedServiceId(service.id);
                          form.setValue("serviceName", service.name);
                          setIsAddingNewSubcategory(false);
                          
                          // Find or create subcategory for this service
                          const subcategoryId = await findOrCreateSubcategoryForService(service.name, service.logo);
                          if (subcategoryId) {
                            form.setValue("subcategoryId", subcategoryId);
                          } else {
                            form.setValue("subcategoryId", null);
                          }
                          
                          // Load plans for this service
                          loadPlansForService(service.id);
                        }}
                      >
                        <CardContent className="p-2 flex flex-col items-center justify-center h-full">
                          <div className="flex flex-col items-center gap-1 text-center">
                            {isSelected && (
                              <Check className="h-4 w-4 text-primary mb-1" />
                            )}
                            {service.logo ? (
                                  <img
                                    src={service.logo}
                                    alt={service.name}
                                className="h-8 w-8 object-contain mb-1"
                                  />
                            ) : (
                              <div className="h-8 w-8 mb-1" />
                                )}
                            <span className="font-medium text-xs leading-tight">
                              {service.name}
                            </span>
                              </div>
                        </CardContent>
                      </Card>
                      );
                  });
                })()}
                      </div>
                )}

            {isAddingNewSubcategory && (
              <div className="space-y-2">
                <Select
                  value={selectedCategoryId || ""}
                  onValueChange={(value) => {
                    setSelectedCategoryId(value);
                    form.setValue("categoryId", value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category for new subcategory" />
                  </SelectTrigger>
                  <SelectContent>
                    {allCategories
                      .filter((category) => {
                        const groupName = category.group?.name?.toLowerCase() || "";
                        return groupName === "subscriptions" || groupName === "subscription";
                      })
                      .map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter new subcategory name"
                    value={newSubcategoryName}
                    onChange={(e) => setNewSubcategoryName(e.target.value)}
                  />
                  <Button
                    type="button"
                    onClick={handleCreateNewSubcategory}
                    variant="outline"
                  >
                    Create
                  </Button>
                </div>
              </div>
            )}

            {/* Show available plans when a service is selected */}
            {selectedServiceId && !isAddingNewSubcategory && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Plan (Optional)</label>
                {loadingPlans ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading plans...</span>
                  </div>
                ) : availablePlans.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    <Card
                      className={`cursor-pointer transition-all hover:border-primary w-[100px] h-[100px] flex items-center justify-center ${
                        selectedPlanId === null
                          ? "border-primary border-2 bg-primary/5"
                          : "border-border"
                      }`}
                      onClick={() => {
                        setSelectedPlanId(null);
                        form.setValue("planId", null);
                        // Don't change the amount, let user keep their custom value
                      }}
                    >
                      <CardContent className="p-2 flex flex-col items-center justify-center h-full">
                        <div className="flex flex-col items-center gap-1 text-center">
                          {selectedPlanId === null && (
                            <Check className="h-4 w-4 text-primary mb-1" />
                          )}
                          <span className="font-medium text-xs leading-tight text-muted-foreground">
                            Custom
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Manual
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                    {availablePlans.map((plan) => {
                      const isSelected = selectedPlanId === plan.id;
                      return (
                        <Card
                          key={plan.id}
                          className={`cursor-pointer transition-all hover:border-primary w-[100px] h-[100px] flex items-center justify-center ${
                            isSelected
                              ? "border-primary border-2 bg-primary/5"
                              : "border-border"
                          }`}
                          onClick={() => {
                            setSelectedPlanId(plan.id);
                            form.setValue("amount", plan.price);
                            form.setValue("planId", plan.id);
                          }}
                        >
                          <CardContent className="p-2 flex flex-col items-center justify-center h-full">
                            <div className="flex flex-col items-center gap-1 text-center">
                              {isSelected && (
                                <Check className="h-4 w-4 text-primary mb-1" />
                              )}
                              <span className="font-medium text-xs leading-tight">
                                {plan.planName}
                              </span>
                              <span className="text-sm font-semibold">
                                {formatMoney(plan.price)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {plan.currency}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No plans available for this service. Enter amount manually.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Amount and Account */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Amount</label>
              <DollarAmountInput
                value={form.watch("amount")}
                onChange={(value) => form.setValue("amount", value ?? 0)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Account</label>
              <Select
                value={form.watch("accountId")}
                onValueChange={(value) => form.setValue("accountId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Billing Frequency and First Billing Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Billing Frequency</label>
              <Tabs
                value={form.watch("billingFrequency")}
                onValueChange={(value) => {
                  form.setValue("billingFrequency", value as "monthly" | "weekly" | "biweekly" | "semimonthly" | "daily");
                }}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="monthly">Monthly</TabsTrigger>
                  <TabsTrigger value="yearly">Yearly</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">First Billing Date</label>
              <DatePicker
                date={(() => {
                  const value = form.watch("firstBillingDate");
                  if (!value) return undefined;
                  if (value instanceof Date) return value;
                  return new Date(value as string);
                })()}
                onDateChange={(date) => {
                  if (date) {
                    form.setValue("firstBillingDate", date);
                  }
                }}
                placeholder="Select first billing date"
                required
              />
            </div>
          </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {subscription ? "Updating..." : "Creating..."}
                </>
              ) : (
                subscription ? "Update" : "Create"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

