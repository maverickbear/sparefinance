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
import { formatTransactionDate, parseDateInput, formatDateInput } from "@/lib/utils/timestamp";
import { useToast } from "@/components/toast-provider";
import { Loader2, Plus } from "lucide-react";
import { Combobox, type ComboboxItem, type ComboboxGroup } from "@/components/ui/combobox";
import { getAllCategoriesClient } from "@/lib/api/categories-client";
import type { Category } from "@/lib/api/categories-client";
import { getAccountsClient } from "@/lib/api/accounts-client";
import type { Account } from "@/lib/api/accounts-client";
import {
  createUserSubscriptionClient,
  updateUserSubscriptionClient,
  type UserServiceSubscription,
  type UserServiceSubscriptionFormData,
} from "@/lib/api/user-subscriptions-client";

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
  const [isAddingNewSubcategory, setIsAddingNewSubcategory] = useState(false);
  const [newSubcategoryName, setNewSubcategoryName] = useState("");

  // Get all subcategories grouped by category (only from Subscriptions group) for Combobox
  const getComboboxGroups = (): ComboboxGroup[] => {
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
        items: category.subcategories!.map((subcat) => ({
          id: subcat.id,
          name: subcat.name,
          categoryId: category.id,
        })),
      }));
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
    },
  });

  // Watch billing frequency
  const watchedBillingFrequency = form.watch("billingFrequency");

  useEffect(() => {
    setBillingFrequency(watchedBillingFrequency);
  }, [watchedBillingFrequency]);

  // Load accounts and categories
  useEffect(() => {
    if (open) {
      loadAccounts();
      loadAllCategories();
    }
  }, [open]);


  // Initialize form when editing
  useEffect(() => {
    if (open && subscription) {
      form.reset({
        serviceName: subscription.serviceName,
        subcategoryId: subscription.subcategoryId || null,
        amount: subscription.amount,
        description: subscription.description || "",
        billingFrequency: subscription.billingFrequency,
        accountId: subscription.accountId,
        firstBillingDate: subscription.firstBillingDate ? new Date(subscription.firstBillingDate) : new Date(),
        categoryId: null,
        newSubcategoryName: null,
      });
      setBillingFrequency(subscription.billingFrequency);
      
      // Load subcategory if exists
      if (subscription.subcategoryId) {
        loadSubcategoryInfo(subscription.subcategoryId);
      }
    } else if (open && !subscription) {
      form.reset({
        serviceName: "",
        subcategoryId: null,
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
      setSubcategories([]);
      setIsAddingNewSubcategory(false);
      setNewSubcategoryName("");
    }
  }, [open, subscription, accounts.length]);

  async function loadAccounts() {
    try {
      const data = await getAccountsClient();
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
      const categories = await getAllCategoriesClient();
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

  function handleComboboxChange(value: string | null, item: ComboboxItem | null) {
    if (item) {
      // Selected an existing subcategory
      form.setValue("subcategoryId", item.id);
      form.setValue("serviceName", item.name);
      setSelectedCategoryId((item as any).categoryId || "");
      setIsAddingNewSubcategory(false);
    } else if (value) {
      // Custom value typed by user
      form.setValue("serviceName", value);
      form.setValue("subcategoryId", null);
      setIsAddingNewSubcategory(false);
    } else {
      // Cleared
      form.setValue("serviceName", "");
      form.setValue("subcategoryId", null);
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

      if (subscription) {
        await updateUserSubscriptionClient(subscription.id, formData);
        toast({
          title: "Success",
          description: "Subscription updated successfully",
          variant: "success",
        });
      } else {
        await createUserSubscriptionClient(formData);
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
            <label className="text-sm font-medium">Service Name</label>
            <Combobox
              groups={getComboboxGroups()}
              value={form.watch("subcategoryId") || form.watch("serviceName") || null}
              onChange={handleComboboxChange}
              placeholder="Select or type service name..."
              searchPlaceholder="Search or type service name..."
              emptyMessage="No subcategories found in Subscriptions group."
              noResultsMessage="No matches found. Type to create custom service name."
              allowCustomValue={true}
              size="large"
              showClearButton={true}
              onCreateNew={() => setIsAddingNewSubcategory(true)}
              createNewLabel="Create New Subcategory"
            />

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
              <Input
                type="date"
                {...form.register("firstBillingDate", { required: true })}
                value={
                  form.watch("firstBillingDate")
                    ? formatDateInput(
                        form.watch("firstBillingDate") instanceof Date
                          ? form.watch("firstBillingDate")
                          : new Date(form.watch("firstBillingDate"))
                      )
                    : ""
                }
                onChange={(e) => {
                  const date = parseDateInput(e.target.value);
                  if (date) {
                    form.setValue("firstBillingDate", date);
                  }
                }}
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

