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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

  
  // New subscription services state
  const [subscriptionServiceCategories, setSubscriptionServiceCategories] = useState<any[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  // Get all subcategories from Subscriptions category for Select
  const getSubscriptionsSubcategories = () => {
    // Filter categories to only include those with "subscription" in the name (groups removed)
    const subscriptionsCategories = allCategories.filter((category) => {
      const categoryName = category.name?.toLowerCase() || "";
      return categoryName.includes("subscription");
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
    // Filter categories to only include those with "subscription" in the name (groups removed)
    const subscriptionsCategories = allCategories.filter((category) => {
      const categoryName = category.name?.toLowerCase() || "";
      return categoryName.includes("subscription");
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
    
    // Filter categories to only include those with "subscription" in the name (groups removed)
    const subscriptionsCategories = allCategories.filter((category) => {
      const categoryName = category.name?.toLowerCase() || "";
      return categoryName.includes("subscription");
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
  const [billingFrequency, setBillingFrequency] = useState<"monthly" | "yearly" | "weekly" | "biweekly" | "semimonthly" | "daily">("monthly");

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
        }
      }
    } catch (error) {
      console.error("Error loading subscription services:", error);
    }
  }




  // Set category filter when editing and categories are loaded
  useEffect(() => {
    if (open && subscription && subscription.subcategoryId && allCategories.length > 0) {
      // Find the subcategory in the loaded categories (groups removed)
      const subscriptionsCategories = allCategories.filter((category) => {
        const categoryName = category.name?.toLowerCase() || "";
        return categoryName.includes("subscription");
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
        planId: null, // Plans are no longer used - users enter amounts manually
        amount: subscription.amount,
        description: subscription.description || "",
        billingFrequency: subscription.billingFrequency,
        accountId: subscription.accountId,
        firstBillingDate: subscription.firstBillingDate ? new Date(subscription.firstBillingDate) : new Date(),
        categoryId: null,

      });
      setBillingFrequency(subscription.billingFrequency);
      
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
      });
      setBillingFrequency("monthly");
      setSelectedCategoryId("");
      setSelectedCategoryFilter(null);
      setSubcategories([]);

      setSelectedServiceId(null);
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
        const res = await fetch(`/api/v2/categories?categoryId=${selectedCategoryId || ""}`);
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
      const res = await fetch(`/api/v2/categories?categoryId=${categoryId}`);
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
      form.setValue("serviceName", "");
      form.setValue("subcategoryId", null);
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
      }
    }
  }





  async function onSubmit(data: UserServiceSubscriptionFormData) {
    try {
      setIsSubmitting(true);

      // Check if service name matches an existing subcategory in the selected category
      let finalSubcategoryId = data.subcategoryId;
      let finalNewSubcategoryName = null;
      let finalCategoryId = data.categoryId;

      if (selectedCategoryId && data.serviceName) {
         // Fix: Check if selectedCategoryId is a real DB category
         // If "virtual" (like 'cat-software'), fallback to the first "Subscription" category
         const isRealCategory = allCategories.some(c => c.id === selectedCategoryId);
         let targetCategoryId = selectedCategoryId;

         if (!isRealCategory) {
            const subscriptionsCategories = allCategories.filter((category) => {
              const categoryName = category.name?.toLowerCase() || "";
              return categoryName.includes("subscription");
            });
            if (subscriptionsCategories.length > 0) {
              targetCategoryId = subscriptionsCategories[0].id;
            } else {
              // Server will resolve: create "Subscription" or use first expense category
              targetCategoryId = selectedCategoryId;
            }
         }
         
         finalCategoryId = targetCategoryId;
         
         // Find subcategories for this category to check for duplicates
         // Use the original selectedCategoryId for UI consistency if we have subcategories loaded for it
         // But for creation we MUST use targetCategoryId
         let subcats: any[] = [];
         
         // Try to get subcategories from the target category (real one)
         const realCategory = allCategories.find(c => c.id === targetCategoryId);
         if (realCategory?.subcategories) {
           subcats = realCategory.subcategories;
         }
         
         if (subcats.length === 0) {
           // Fallback to currently loaded subcategories state
           subcats = subcategories;
         }

         const existingSubcategory = subcats.find(
           (sc) => sc.name.toLowerCase() === data.serviceName.trim().toLowerCase()
         );

         if (existingSubcategory) {
           finalSubcategoryId = existingSubcategory.id;
           finalNewSubcategoryName = null;
         } else {
           finalSubcategoryId = null;
           finalNewSubcategoryName = data.serviceName.trim();
         }
      }

      const formData: UserServiceSubscriptionFormData = {
        ...data,
        firstBillingDate: data.firstBillingDate instanceof Date 
          ? data.firstBillingDate 
          : new Date(data.firstBillingDate),
        categoryId: finalCategoryId,
        subcategoryId: finalSubcategoryId,
        newSubcategoryName: finalNewSubcategoryName,
        serviceName: data.serviceName.trim(), 
      };

      // Save subscription
      let savedSubscription: UserServiceSubscription;
      if (subscription) {
        const response = await fetch(`/api/v2/user-subscriptions/${subscription.id}`, {
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
        const response = await fetch("/api/v2/user-subscriptions", {
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col w-full !p-0 !gap-0 sm:max-w-xl overflow-hidden">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border text-left">
          <SheetTitle>
            {subscription ? "Edit Subscription" : "Create Subscription"}
          </SheetTitle>
          <SheetDescription>
            {subscription
              ? "Update your subscription details"
              : "Create a new subscription to track recurring payments"}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {/* Service Name / Subcategory */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Subscription Category</label>
              <Select
                value={selectedCategoryFilter || ""}
                onValueChange={(value) => {
                  const categoryId = value === "all" ? null : value;
                  handleCategoryFilterClick(categoryId);
                  // Ensure selectedCategoryId is set for "Create New" functionality
                  if (categoryId) {
                    setSelectedCategoryId(categoryId);
                    form.setValue("categoryId", categoryId);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {getSubscriptionCategories().map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Service Name</label>
              <Input
                placeholder="e.g. Netflix, Spotify, Gym"
                disabled={!selectedCategoryFilter}
                {...form.register("serviceName")}
              />
            </div>
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
                  form.setValue("billingFrequency", value as "monthly" | "yearly" | "weekly" | "biweekly" | "semimonthly" | "daily");
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

          <SheetFooter className="px-6 py-4 border-t border-border">
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
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

