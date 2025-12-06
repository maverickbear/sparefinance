"use client";

import { useForm } from "react-hook-form";
import { logger } from "@/src/infrastructure/utils/logger";
import { zodResolver } from "@hookform/resolvers/zod";
import { transactionSchema, TransactionFormData } from "@/src/domain/transactions/transactions.validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from "@/components/ui/select";
import { Loader2, Info, Plus, Receipt, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import React, { useEffect, useState } from "react";
import { useToast } from "@/components/toast-provider";
import type { Transaction } from "@/src/domain/transactions/transactions.types";
import { LimitWarning } from "@/components/billing/limit-warning";
import { DollarAmountInput } from "@/components/common/dollar-amount-input";
import { AccountRequiredDialog } from "@/components/common/account-required-dialog";
import { parseDateInput, formatDateInput } from "@/src/infrastructure/utils/timestamp";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DatePicker } from "@/components/ui/date-picker";
import { ReceiptScanner } from "@/components/receipt-scanner/receipt-scanner";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { useSubscriptionSafe } from "@/contexts/subscription-context";
// Plaid metadata type (kept for backward compatibility with existing data)
type PlaidTransactionMetadata = Record<string, unknown>;
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// Component for draggable group pills on desktop
function GroupPillsScrollable({
  groups,
  selectedGroupId,
  onGroupSelect,
}: {
  groups: Array<{ id: string; name: string; type?: "income" | "expense" | null }>;
  selectedGroupId: string | null;
  onGroupSelect: (groupId: string) => void;
}) {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [startX, setStartX] = React.useState(0);
  const [scrollLeft, setScrollLeft] = React.useState(0);
  const [isDesktop, setIsDesktop] = React.useState(false);

  // Check if desktop
  React.useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 640); // sm breakpoint
    };
    checkDesktop();
    window.addEventListener("resize", checkDesktop);
    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  // Handle mouse down for drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isDesktop || !scrollContainerRef.current) return;
    
    // Don't start drag if clicking on a button
    const target = e.target as HTMLElement;
    if (target.tagName === "BUTTON" || target.closest("button")) {
      return;
    }

    setIsDragging(true);
    setStartX(e.pageX - (scrollContainerRef.current?.offsetLeft || 0));
    setScrollLeft(scrollContainerRef.current?.scrollLeft || 0);
    e.preventDefault();
  };

  // Handle mouse move for drag
  React.useEffect(() => {
    if (!isDragging || !isDesktop) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!scrollContainerRef.current) return;
      e.preventDefault();
      const x = e.pageX - (scrollContainerRef.current.offsetLeft || 0);
      const walk = (x - startX) * 2; // Scroll speed multiplier
      scrollContainerRef.current.scrollLeft = scrollLeft - walk;
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, startX, scrollLeft, isDesktop]);

  return (
    <div
      ref={scrollContainerRef}
      className={cn(
        "flex gap-2 overflow-x-auto pb-2 scrollbar-hide",
        isDesktop && isDragging && "cursor-grabbing select-none",
        isDesktop && !isDragging && "cursor-grab"
      )}
      onMouseDown={handleMouseDown}
      style={{
        WebkitOverflowScrolling: 'touch',
        scrollSnapType: 'x mandatory',
        ...(isDesktop && {
          userSelect: 'none',
        }),
      }}
    >
      {groups.map((group) => (
        <button
          key={group.id}
          type="button"
          onClick={() => onGroupSelect(group.id)}
          className={cn(
            "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0",
            "scroll-snap-align-start",
            selectedGroupId === group.id
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-accent"
          )}
          style={{
            pointerEvents: isDragging ? 'none' : 'auto',
          }}
        >
          {group.name}
        </button>
      ))}
    </div>
  );
}

/**
 * Converts a Date object to YYYY-MM-DD string format
 * This ensures we send date-only strings to the backend, avoiding timezone issues
 * that can occur with toISOString() which includes time and timezone
 */
function toDateOnlyString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction | null;
  onSuccess?: () => void;
  defaultType?: "expense" | "income" | "transfer";
}

interface Account {
  id: string;
  name: string;
  type: string;
}

// Helper function to format account type for display
function formatAccountType(type: string): string {
  const typeMap: Record<string, string> = {
    checking: "Checking",
    savings: "Savings",
    credit: "Credit Card",
    cash: "Cash",
    investment: "Investment",
    other: "Other",
  };
  return typeMap[type.toLowerCase()] || type;
}


interface Category {
  id: string;
  name: string;
  groupId?: string;
  macroId?: string; // Deprecated, for backward compatibility
  group?: {
    id: string;
    name: string;
    type?: "income" | "expense" | null;
  } | null;
  macro?: {
    id: string;
    name: string;
    type?: "income" | "expense" | null;
  } | null; // Deprecated, for backward compatibility
  subcategories?: Array<{
    id: string;
    name: string;
  }>;
}

interface Subcategory {
  id: string;
  name: string;
  categoryId: string;
}

export function TransactionForm({ open, onOpenChange, transaction, onSuccess, defaultType = "expense" }: TransactionFormProps) {
  // Set date after component mounts to avoid SSR/prerendering issues
  const [defaultDate, setDefaultDate] = useState<Date | null>(null);

  useEffect(() => {
    setDefaultDate(new Date());
  }, []);
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [subcategoriesMap, setSubcategoriesMap] = useState<Map<string, Array<{ id: string; name: string }>>>(new Map());
  const [transactionLimit, setTransactionLimit] = useState<{ current: number; limit: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [shouldShowForm, setShouldShowForm] = useState(false);
  const [showAddCategoryDialog, setShowAddCategoryDialog] = useState(false);
  const [availableGroups, setAvailableGroups] = useState<Array<{ id: string; name: string; type?: "income" | "expense" | null }>>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [selectedFilterGroupId, setSelectedFilterGroupId] = useState<string | null>(null); // For filtering categories
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [isReceiptScannerOpen, setIsReceiptScannerOpen] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(transaction?.receiptUrl || null);
  const breakpoint = useBreakpoint();
  const isMobile = !breakpoint || breakpoint === "xs" || breakpoint === "sm" || breakpoint === "md";
  const { limits, subscription } = useSubscriptionSafe();
  
  // Check if receipt scanner feature is enabled
  // Default to false if not within SubscriptionProvider (safe fallback)
  const hasReceiptScanner = limits.hasReceiptScanner === true || String(limits.hasReceiptScanner) === "true";
  
  // Check if user can create categories (requires active or trialing subscription)
  const canCreateCategory = subscription?.status === "active" || subscription?.status === "trialing";

  // Listen for custom event to open receipt scanner (from mobile FAB)
  useEffect(() => {
    const handleOpenReceiptScanner = () => {
      if (open && !transaction) {
        setIsReceiptScannerOpen(true);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('openReceiptScanner', handleOpenReceiptScanner);
      return () => {
        window.removeEventListener('openReceiptScanner', handleOpenReceiptScanner);
      };
    }
  }, [open, transaction]);

  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      date: defaultDate || new Date('2024-01-01'), // Fallback date, will be updated when defaultDate is set
      type: "expense",
      amount: 0,
      recurring: false,
      recurringFrequency: undefined,
    },
  });

  // Update form default value when date is available
  useEffect(() => {
    if (defaultDate && !transaction) {
      form.setValue('date', defaultDate);
    }
  }, [defaultDate, transaction, form]);

  // Check for receipt data from bottom sheet
  useEffect(() => {
    if (open && !transaction && typeof window !== 'undefined') {
      const receiptData = (window as any).__receiptData;
      if (receiptData) {
        // Pre-fill form with receipt data
        if (receiptData.amount) {
          form.setValue("amount", receiptData.amount);
        }
        if (receiptData.description) {
          form.setValue("description", receiptData.description);
        }
        if (receiptData.merchant && !receiptData.description) {
          form.setValue("description", receiptData.merchant);
        }
        if (receiptData.date) {
          try {
            const date = new Date(receiptData.date);
            if (!isNaN(date.getTime())) {
              form.setValue("date", date);
            }
          } catch (e) {
            // Invalid date, ignore
          }
        }
        // Set type to expense by default for receipts
        form.setValue("type", "expense");
        // Clear receipt data after using it
        delete (window as any).__receiptData;
      }
    }
  }, [open, transaction, form]);

  useEffect(() => {
    // Update receiptUrl when transaction changes
    if (transaction?.receiptUrl) {
      setReceiptUrl(transaction.receiptUrl);
    } else if (!transaction) {
      setReceiptUrl(null);
    }
  }, [transaction]);

  useEffect(() => {
    if (open) {
      // If editing a transaction, no need to check accounts
      if (transaction) {
        setShouldShowForm(true);
        loadData();
        loadTransactionLimit();
        
        // Ensure amount is valid (must be positive)
        const amount = transaction.amount && transaction.amount > 0 ? transaction.amount : 0.01;
        
        // Ensure accountId exists
        if (!transaction.accountId) {
          console.error("[TransactionForm] Transaction missing accountId", transaction);
          // Don't show toast in useEffect, it will be handled when form is submitted
        }
        
        console.log("[TransactionForm] Resetting form with transaction data", {
          transactionId: transaction.id,
          amount,
          accountId: transaction.accountId,
          type: transaction.type,
        });
        
        // Extract merchant from plaidMetadata
        const plaidMetadata = transaction.plaidMetadata as PlaidTransactionMetadata | null;
        const merchantName = plaidMetadata?.merchantName || 
                            (plaidMetadata as any)?.merchant_name || 
                            null;

        const formData: any = {
          date: new Date(transaction.date),
          type: transaction.type as "expense" | "income" | "transfer",
          amount: amount,
          accountId: transaction.accountId || "",
          toAccountId: (transaction as any).toAccountId || undefined,
          transferFromId: (transaction as any).transferFromId || undefined,
          categoryId: transaction.categoryId || undefined,
          subcategoryId: transaction.subcategoryId || undefined,
          merchant: merchantName || "",
          description: transaction.description || "",
          recurring: transaction.isRecurring ?? false,
          recurringFrequency: (transaction as any).recurringFrequency || (transaction.isRecurring ? "monthly" : undefined),
        };
        
        // Only include expenseType if type is expense and it has a value
        if (transaction.type === "expense" && transaction.expenseType) {
          formData.expenseType = transaction.expenseType as "fixed" | "variable";
        }
        
        console.log("[TransactionForm] Form data to reset", formData);
        
        form.reset(formData);
        
        // Trigger validation after reset to show any errors immediately
        setTimeout(() => {
          form.trigger();
        }, 100);
        // Category will be loaded by the useEffect that handles transaction editing
      } else {
        // If creating a new transaction, check if there are accounts
        checkAccountsAndShowForm();
      }
    } else {
      setShouldShowForm(false);
      setShowAccountDialog(false);
    }
  }, [open, transaction]);


  async function checkAccountsAndShowForm() {
    try {
      // OPTIMIZED: Only fetch accounts if we don't have them yet
      // This avoids duplicate calls when form is opened multiple times
      if (accounts.length === 0) {
      const accountsRes = await fetch("/api/v2/accounts");
      if (accountsRes.ok) {
        const accountsData = await accountsRes.json().catch(() => []);
          setAccounts(accountsData);
          
        if (accountsData.length === 0) {
          // No accounts, show the dialog
          setShowAccountDialog(true);
          setShouldShowForm(false);
            return;
          }
        }
      }
      
      // Has accounts (either from cache or just fetched), can show the form
          setShouldShowForm(true);
      
      // OPTIMIZED: Only load data if accounts were just fetched or if we need to refresh
      // This avoids duplicate calls when form is opened multiple times
      if (accounts.length === 0) {
          loadData();
      }
      
          loadTransactionLimit();
          form.reset({
            date: new Date(),
            type: defaultType,
            amount: 0,
            recurring: false,
          });
          setSelectedCategoryId("");
          setSubcategories([]);
          setSubcategoriesMap(new Map());
    } catch (error) {
      console.error("Error checking accounts:", error);
      // In case of error, try to show the form anyway
      setShouldShowForm(true);
      if (accounts.length === 0) {
      loadData();
      }
      loadTransactionLimit();
    }
  }

  // Load macros when form opens or type changes
  // Load all categories when form opens or type changes
  useEffect(() => {
    if (open) {
      loadAllCategories();
    }
  }, [open, form.watch("type")]);

  // Load available groups when form opens, type changes, or add category dialog opens
  useEffect(() => {
    if (open) {
      loadAvailableGroups();
    }
  }, [open, form.watch("type"), showAddCategoryDialog]);

  // Load subcategories when category is selected
  useEffect(() => {
    if (selectedCategoryId && open) {
      loadSubcategoriesForCategory(selectedCategoryId);
    } else if (!selectedCategoryId) {
      setSubcategories([]);
      form.setValue("subcategoryId", undefined);
    }
  }, [selectedCategoryId, open]);

  // Keep form.categoryId in sync with selectedCategoryId
  useEffect(() => {
    if (open && form.watch("type") !== "transfer") {
      const formCategoryId = form.watch("categoryId");
      if (selectedCategoryId && selectedCategoryId !== "" && formCategoryId !== selectedCategoryId) {
        form.setValue("categoryId", selectedCategoryId, { shouldValidate: false });
      } else if (!selectedCategoryId && formCategoryId) {
        // If form has categoryId but state doesn't, sync state from form
        setSelectedCategoryId(formCategoryId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategoryId, open]);

  async function loadData() {
    try {
      // OPTIMIZED: Only fetch accounts if we don't have them yet
      // This avoids duplicate calls when form is opened multiple times
      if (accounts.length === 0) {
      const accountsRes = await fetch("/api/v2/accounts");
      
      if (!accountsRes.ok) {
        logger.error("Error fetching accounts:", accountsRes.status, accountsRes.statusText);
        setAccounts([]);
      } else {
        const accountsData = await accountsRes.json().catch(() => []);
        setAccounts(accountsData);
        }
      }
    } catch (error) {
      logger.error("Error loading data:", error);
      if (accounts.length === 0) {
      setAccounts([]);
      }
    }
  }

  async function loadAllCategories() {
    try {
      const res = await fetch("/api/v2/categories?all=true");
      if (!res.ok) {
        throw new Error("Failed to fetch categories");
      }
      const categories = await res.json();
      
      // Handle relations (ensure consistent format)
      const formattedCategories = (categories || []).map((cat: any) => {
        // Handle group (new) and macro (deprecated) for backward compatibility
        const group = Array.isArray(cat.group) ? (cat.group.length > 0 ? cat.group[0] : null) : 
                     (cat.group || (Array.isArray(cat.macro) ? (cat.macro.length > 0 ? cat.macro[0] : null) : cat.macro));
        
        return {
          ...cat,
          group: group,
          macro: group, // For backward compatibility
          subcategories: Array.isArray(cat.subcategories) ? cat.subcategories : [],
        };
      });
      
      setAllCategories(formattedCategories);
      
      // Load subcategories for all categories
      const newSubcategoriesMap = new Map<string, Array<{ id: string; name: string }>>();
      for (const category of formattedCategories) {
        if (category.subcategories && category.subcategories.length > 0) {
          newSubcategoriesMap.set(category.id, category.subcategories.map((sub: any) => ({
            id: sub.id,
            name: sub.name,
          })));
        }
      }
      setSubcategoriesMap(newSubcategoriesMap);
    } catch (error) {
      logger.error("Error loading categories:", error);
      setAllCategories([]);
      setSubcategoriesMap(new Map());
    }
  }

  async function loadAvailableGroups() {
    try {
      const response = await fetch("/api/v2/categories?consolidated=true");
      if (!response.ok) {
        throw new Error("Failed to fetch groups");
      }
      const data = await response.json();
      const groups = data.groups || [];
      const transactionType = form.getValues("type");
      
      // Filter groups by transaction type
      const filteredGroups = groups.filter((group: any) => {
        if (transactionType === "expense") {
          return group.type === "expense" || group.type === null;
        } else if (transactionType === "income") {
          return group.type === "income" || group.type === null;
        }
        return true;
      });
      
      setAvailableGroups(filteredGroups);
    } catch (error) {
      logger.error("Error loading groups:", error);
      setAvailableGroups([]);
    }
  }

  async function handleCreateCategory() {
    if (!newCategoryName.trim() || !selectedGroupId) {
      toast({
        title: "Error",
        description: "Please enter a category name and select a group",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingCategory(true);
    try {
      const res = await fetch("/api/v2/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCategoryName.trim(),
          groupId: selectedGroupId,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create category");
      }

      const newCategory = await res.json();
      
      toast({
        title: "Category created",
        description: "The category has been created successfully.",
        variant: "success",
      });

      // Reload categories
      await loadAllCategories();
      
      // Select the newly created category
      setSelectedCategoryId(newCategory.id);
      form.setValue("categoryId", newCategory.id);
      form.setValue("subcategoryId", undefined);
      
      // Close dialogs
      setShowAddCategoryDialog(false);
      setNewCategoryName("");
      setSelectedGroupId("");
      
      // Load subcategories for the new category
      if (newCategory.id) {
        loadSubcategoriesForCategory(newCategory.id);
      }
    } catch (error) {
      logger.error("Error creating category:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create category",
        variant: "destructive",
      });
    } finally {
      setIsCreatingCategory(false);
    }
  }

  async function loadTransactionLimit() {
    try {
      const { getBillingLimitsAction } = await import("@/lib/actions/billing");
      const limits = await getBillingLimitsAction();
      if (limits?.transactionLimit) {
        setTransactionLimit({
          current: limits.transactionLimit.current,
          limit: limits.transactionLimit.limit,
        });
      }
    } catch (error) {
      logger.error("Error loading transaction limit:", error);
    }
  }

  async function loadSubcategoriesForCategory(categoryId: string) {
    try {
      const subcategories = subcategoriesMap.get(categoryId);
      if (subcategories && subcategories.length > 0) {
        setSubcategories(subcategories.map(sc => ({ ...sc, categoryId: (sc as any).categoryId || categoryId })));
      } else {
        // Fetch if not in map
        const res = await fetch(`/api/v2/categories?categoryId=${categoryId}`);
        if (res.ok) {
          const subcats = await res.json().catch(() => []);
          setSubcategories(subcats.map((sc: any) => ({ ...sc, categoryId: sc.categoryId || categoryId })));
          // Update map
          if (subcats && subcats.length > 0) {
            setSubcategoriesMap(prev => new Map(prev).set(categoryId, subcats));
          }
        } else {
          setSubcategories([]);
        }
      }
    } catch (error) {
      logger.error("Error loading subcategories:", error);
      setSubcategories([]);
    }
  }

  // Initialize form when editing a transaction
  useEffect(() => {
    if (open && transaction && transaction.categoryId) {
      setSelectedCategoryId(transaction.categoryId);
      form.setValue("categoryId", transaction.categoryId);
      if (transaction.subcategoryId) {
        loadSubcategoriesForCategory(transaction.categoryId);
      }
    }
  }, [open, transaction]);

  function handleCategoryChange(categoryId: string) {
    // Handle special "Add Category" action
    if (categoryId === "__add_category__") {
      setShowAddCategoryDialog(true);
      return;
    }
    
    setSelectedCategoryId(categoryId);
    form.setValue("categoryId", categoryId);
    form.setValue("subcategoryId", undefined);
    // Load subcategories for the selected category
    if (categoryId) {
      loadSubcategoriesForCategory(categoryId);
    } else {
      setSubcategories([]);
    }
  }

  function handleSubcategoryChange(subcategoryId: string) {
    if (subcategoryId && subcategoryId !== "") {
      form.setValue("subcategoryId", subcategoryId);
    } else {
      form.setValue("subcategoryId", undefined);
    }
  }

  async function saveTransaction(data: TransactionFormData, closeDialog: boolean = true) {
    try {
      console.log("[TransactionForm] saveTransaction called", { 
        isEditing: !!transaction, 
        transactionId: transaction?.id,
        data,
        selectedCategoryId,
        closeDialog
      });
      
      setIsSubmitting(true);

      // Sync categoryId from selectedCategoryId state if form value is missing
      // This ensures the category is always included when selected
      if (data.type !== "transfer" && selectedCategoryId && selectedCategoryId !== "" && !data.categoryId) {
        data.categoryId = selectedCategoryId;
        form.setValue("categoryId", selectedCategoryId);
      }
      
      // Also sync from form value to selectedCategoryId if form has value but state doesn't
      if (data.type !== "transfer" && data.categoryId && data.categoryId !== "" && !selectedCategoryId) {
        setSelectedCategoryId(data.categoryId);
      }

      // Check if date is in the future
      const transactionDate = data.date instanceof Date ? data.date : new Date(data.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      transactionDate.setHours(0, 0, 0, 0);
      const isFutureDate = transactionDate > today;

      // If date is in the future and it's a new transaction, automatically save as Planned Payment
      if (isFutureDate && !transaction) {
        // Create as PlannedPayment
        const response = await fetch("/api/v2/planned-payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: transactionDate instanceof Date ? toDateOnlyString(transactionDate) : transactionDate,
            type: data.type,
            amount: data.amount,
            accountId: data.accountId,
            toAccountId: data.type === "transfer" ? (data.toAccountId || null) : null,
            categoryId: data.type === "transfer" ? null : (data.categoryId || null),
            subcategoryId: data.type === "transfer" ? null : (data.subcategoryId || null),
            description: data.description || null,
            source: "manual",
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to create planned payment");
        }

        toast({
          title: "Planned Payment created",
          description: "This payment has been saved as a planned payment and won't affect your current balance.",
          variant: "success",
        });

        // Reload data
        onSuccess?.();
        setTimeout(() => {
          onSuccess?.();
        }, 500);

        // If closeDialog is true, close the form and reset
        if (closeDialog) {
          onOpenChange(false);
          form.reset();
        } else {
          // Reset form but keep dialog open
          form.reset({
            date: new Date(),
            type: defaultType,
            amount: 0,
            recurring: false,
            recurringFrequency: undefined,
          });
          setSelectedCategoryId("");
          setSubcategories([]);
          setSubcategoriesMap(new Map());
        }

        setIsSubmitting(false);
        return;
      }

      // Otherwise, create as regular Transaction
      // Check limit before creating (only for new transactions)
      if (!transaction && transactionLimit) {
        if (transactionLimit.limit !== -1 && transactionLimit.current >= transactionLimit.limit) {
          toast({
            title: "Limit Reached",
            description: `You've reached your monthly transaction limit (${transactionLimit.limit}).`,
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }
      }

      const url = transaction ? `/api/v2/transactions/${transaction.id}` : "/api/v2/transactions";
      const method = transaction ? "PATCH" : "POST";
      
      // Serialize data for API - convert Date to YYYY-MM-DD string (not ISO timestamp)
      // This avoids timezone issues since Transaction.date is now a 'date' type in PostgreSQL
      // Remove expenseType if type is not expense (to avoid sending null)
      const payload: any = {
        ...data,
        date: data.date instanceof Date ? toDateOnlyString(data.date) : data.date,
        receiptUrl: receiptUrl || undefined,
      };
      
      // Ensure categoryId is included if selected (for non-transfer transactions)
      // Use selectedCategoryId if it's set and payload doesn't have it, or if payload has empty string
      if (data.type !== "transfer" && selectedCategoryId && selectedCategoryId !== "" && (!payload.categoryId || payload.categoryId === "")) {
        payload.categoryId = selectedCategoryId;
      }
      
      // Remove categoryId if it's an empty string (treat as no category)
      if (payload.categoryId === "") {
        payload.categoryId = undefined;
      }
      
      // Only include expenseType if type is expense
      if (data.type !== "expense") {
        delete payload.expenseType;
      } else if (payload.expenseType === null || payload.expenseType === undefined) {
        // If expense but expenseType is null/undefined, remove it
        delete payload.expenseType;
      }

      console.log("[TransactionForm] Sending request", { url, method, payload, selectedCategoryId });

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      console.log("[TransactionForm] Response received", { status: res.status, ok: res.ok });

      if (!res.ok) {
        let errorMessage = "Failed to save transaction";
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          // If response is not JSON, try to get text
          try {
            const text = await res.text();
            errorMessage = text || errorMessage;
          } catch (textError) {
            // If all else fails, use status text
            errorMessage = res.statusText || errorMessage;
          }
        }
        logger.error("API Error:", { status: res.status, statusText: res.statusText, message: errorMessage });
        throw new Error(errorMessage);
      }

      toast({
        title: transaction ? "Transaction updated" : "Transaction created",
        description: transaction ? "Your transaction has been updated successfully." : "Your transaction has been created successfully.",
        variant: "success",
      });

      // OPTIMIZED: Call onSuccess once with a small delay to ensure server cache is cleared
      // The delay ensures the server-side cache invalidation (revalidateTag) has time to propagate
      // This avoids duplicate calls while ensuring fresh data
      setTimeout(() => {
      console.log("[TransactionForm] Calling onSuccess to reload transactions");
      onSuccess?.();
      }, 100);

      // If closeDialog is true, close the form and reset
      if (closeDialog) {
        onOpenChange(false);
        form.reset();
      } else {
        // Reset form but keep dialog open
        form.reset({
          date: new Date(),
          type: defaultType,
          amount: 0,
          recurring: false,
        });
        setSelectedCategoryId("");
        setSubcategories([]);
        setSubcategoriesMap(new Map());
        // Reload transaction limit for next transaction
        loadTransactionLimit();
      }
    } catch (error) {
      logger.error("Error saving transaction:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save transaction",
        variant: "destructive",
      });
      // Reload limit after error
      loadTransactionLimit();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onSubmit(data: TransactionFormData) {
    await saveTransaction(data, true);
  }

  async function onSubmitAndNew(data: TransactionFormData) {
    await saveTransaction(data, false);
  }

  return (
    <>
      <AccountRequiredDialog
        open={showAccountDialog}
        onOpenChange={(isOpen) => {
          setShowAccountDialog(isOpen);
          if (!isOpen) {
            onOpenChange(false);
          }
        }}
        onAccountCreated={() => {
          setShowAccountDialog(false);
          checkAccountsAndShowForm();
        }}
      />
      {shouldShowForm && (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-2xl sm:max-h-[90vh] flex flex-col !p-0 !gap-0">
        <DialogHeader>
          <DialogTitle>{transaction ? "Edit" : "Add"} Transaction</DialogTitle>
          <DialogDescription>
            {transaction ? "Update the transaction details" : "Create a new transaction"}
          </DialogDescription>
        </DialogHeader>

        <form 
          onSubmit={(e) => {
            console.log("[TransactionForm] Form submit event", { 
              formState: form.formState,
              errors: form.formState.errors,
              values: form.getValues()
            });
            e.preventDefault();
            form.handleSubmit(onSubmit, (errors) => {
              console.log("[TransactionForm] Validation errors", errors);
              
              // Build detailed error message
              const errorMessages = Object.entries(errors).map(([field, error]) => {
                if (error && 'message' in error) {
                  return `${field}: ${error.message}`;
                }
                return `${field}: Invalid value`;
              });
              
              const errorMessage = errorMessages.length > 0 
                ? errorMessages.join(', ')
                : "Please check the form fields and try again.";
              
              toast({
                title: "Validation Error",
                description: errorMessage,
                variant: "destructive",
              });
            })(e);
          }} 
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {/* Show limit warning for new transactions */}
          {!transaction && transactionLimit && transactionLimit.limit !== -1 && (
            <LimitWarning
              current={transactionLimit.current}
              limit={transactionLimit.limit}
              type="transactions"
            />
          )}
          
          {/* Receipt Scanner Button - Primary on Mobile */}
          {!transaction && hasReceiptScanner && (
            <div className={cn(
              "space-y-2",
              isMobile ? "order-first" : ""
            )}>
              {isMobile ? (
                <Button
                  type="button"
                  onClick={() => setIsReceiptScannerOpen(true)}
                  className="w-full"
                  size="large"
                >
                  <Receipt className="h-5 w-5 mr-2" />
                  Scan Receipt
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsReceiptScannerOpen(true)}
                  className="w-full"
                >
                  <Receipt className="h-4 w-4 mr-2" />
                  Scan Receipt to Auto-fill
                </Button>
              )}
            </div>
          )}
          
          <div className="space-y-4">
            {/* ============================================
                1) PRIMARY FIELDS (Mandatory - always visible)
                ============================================ */}
            
            {/* Type */}
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Type
              </label>
              <Tabs
                value={form.watch("type")}
                onValueChange={(value) => {
                  const newType = value as "expense" | "income" | "transfer";
                  form.setValue("type", newType);
                  // Clear category/subcategory for transfers
                  if (newType === "transfer") {
                    form.setValue("categoryId", undefined);
                    form.setValue("subcategoryId", undefined);
                    setSelectedCategoryId("");
                    setSubcategories([]);
                    setSubcategoriesMap(new Map());
                  } else {
                    // When switching between expense and income, clear selected category if its group doesn't match the new type
                    const currentCategory = allCategories.find(c => c.id === selectedCategoryId);
                    if (currentCategory) {
                      // Use group first, then macro for backward compatibility
                      const categoryGroup = currentCategory.group || currentCategory.macro || 
                                           (Array.isArray(currentCategory.group) ? currentCategory.group[0] : null) ||
                                           (Array.isArray(currentCategory.macro) ? currentCategory.macro[0] : null);
                      if (categoryGroup) {
                        const shouldKeepCategory = 
                          (newType === "expense" && (categoryGroup.type === "expense" || categoryGroup.type === null)) ||
                          (newType === "income" && (categoryGroup.type === "income" || categoryGroup.type === null));
                        
                        if (!shouldKeepCategory) {
                          // Clear category and related fields if its group doesn't match the new type
                          setSelectedCategoryId("");
                          form.setValue("categoryId", undefined);
                          form.setValue("subcategoryId", undefined);
                          setSubcategories([]);
                          setSubcategoriesMap(new Map());
                        }
                      }
                    }
                  }
                  // Clear expenseType if not expense
                  if (newType !== "expense") {
                    form.setValue("expenseType", undefined, { shouldValidate: false });
                  }
                  // Reset group filter when type changes
                  setSelectedFilterGroupId(null);
                  // Reload groups when type changes to show correct groups for the new type
                  loadAvailableGroups();
                  }}
                  className="w-full"
                >
                <TabsList className="h-12 w-full grid grid-cols-3">
                  <TabsTrigger value="expense" className="text-sm">Expense</TabsTrigger>
                  <TabsTrigger value="income" className="text-sm">Income</TabsTrigger>
                  <TabsTrigger value="transfer" className="text-sm">Transfer</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Amount and Account row */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  Amount
                </label>
                <DollarAmountInput
                  value={form.watch("amount") || undefined}
                  onChange={(value) => {
                    const numValue = value ?? 0;
                    form.setValue("amount", numValue > 0 ? numValue : 0.01, { shouldValidate: true });
                  }}
                  placeholder="$ 0.00"
                  size="small"
                  required
                />
                {form.formState.errors.amount && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.amount.message}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">
                  {form.watch("type") === "transfer" ? "From Account" : "Account"}
                </label>
                <Select
                  value={form.watch("accountId") || ""}
                  onValueChange={(value) => {
                    form.setValue("accountId", value, { shouldValidate: true });
                  }}
                  required
                >
                  <SelectTrigger size="small">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name} ({formatAccountType(account.type)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.accountId && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.accountId.message}
                  </p>
                )}
              </div>
            </div>

            {/* Date */}
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Date
              </label>
              <DatePicker
                date={form.watch("date")}
                onDateChange={(date) => {
                  form.setValue("date", date || new Date());
                }}
                placeholder="Select date"
                size="small"
                required
              />
            </div>

            {/* Transfer Account Fields */}
            {form.watch("type") === "transfer" && (() => {
              const selectedAccount = accounts.find(acc => acc.id === form.watch("accountId"));
              const isCreditCard = selectedAccount?.type === "credit";
              const hasTransferFromId = !!form.watch("transferFromId");
              
              // Show "From Account" if it's a credit card or if transferFromId already exists
              // Show "To Account" for regular transfers
              if (isCreditCard || hasTransferFromId) {
                return (
                  <div className="space-y-1">
                    <label className="text-sm font-medium">
                      From Account <span className="text-gray-400 text-xs">(optional)</span>
                    </label>
                    <Select
                      value={form.watch("transferFromId") || ""}
                      onValueChange={(value) => {
                        form.setValue("transferFromId", value || undefined);
                        // Clear toAccountId when setting transferFromId
                        if (value) {
                          form.setValue("toAccountId", undefined);
                        }
                      }}
                    >
                      <SelectTrigger size="small">
                        <SelectValue placeholder="Select source account (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None (add later)</SelectItem>
                        {accounts
                          .filter((account) => account.id !== form.watch("accountId") && account.type !== "credit")
                          .map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.name} ({formatAccountType(account.type)})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.transferFromId && (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.transferFromId.message}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Select the account where the payment came from (e.g., checking or savings)
                    </p>
                  </div>
                );
              } else {
                return (
                  <div className="space-y-1">
                    <label className="text-sm font-medium">
                      To Account
                    </label>
                    <Select
                      value={form.watch("toAccountId") || ""}
                      onValueChange={(value) => {
                        form.setValue("toAccountId", value);
                        // Clear transferFromId when setting toAccountId
                        form.setValue("transferFromId", undefined);
                      }}
                      required
                    >
                      <SelectTrigger size="small">
                        <SelectValue placeholder="Select destination account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts
                          .filter((account) => account.id !== form.watch("accountId"))
                          .map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.name} ({formatAccountType(account.type)})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.toAccountId && (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.toAccountId.message}
                      </p>
                    )}
                  </div>
                );
              }
            })()}

            {/* Category and Subcategory (only for non-transfers) */}
            {form.watch("type") !== "transfer" && (
              <div className="space-y-4">
                {/* Group Pills - Horizontal Scroll */}
                {(() => {
                  const transactionType = form.watch("type");
                  
                  // Get all available groups (not just those with categories)
                  // Filter by transaction type
                  const groups = availableGroups
                    .filter((group) => {
                      if (transactionType === "expense") {
                        return group.type === "expense" || group.type === null;
                      } else if (transactionType === "income") {
                        return group.type === "income" || group.type === null;
                      }
                      return true;
                    })
                    .sort((a, b) => a.name.localeCompare(b.name));
                  
                  if (groups.length > 0) {
                    return (
                      <GroupPillsScrollable
                        groups={groups}
                        selectedGroupId={selectedFilterGroupId}
                        onGroupSelect={(groupId) => {
                          setSelectedFilterGroupId(groupId);
                          setSelectedCategoryId("");
                          form.setValue("categoryId", undefined);
                          form.setValue("subcategoryId", undefined);
                        }}
                      />
                    );
                  }
                  return null;
                })()}
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">
                      Category {!selectedCategoryId && <span className="text-gray-400 text-[12px]">required</span>}
                    </label>
                    <Select
                      value={selectedCategoryId && selectedCategoryId !== "__add_category__" ? selectedCategoryId : ""}
                      onValueChange={handleCategoryChange}
                    >
                      <SelectTrigger size="small">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          const transactionType = form.watch("type");
                          
                          // Filter categories by transaction type and selected group
                          const filteredCategories = allCategories.filter((category) => {
                            // Use group first, then macro for backward compatibility
                            const categoryGroup = category.group || category.macro || 
                                                 (Array.isArray(category.group) ? category.group[0] : null) ||
                                                 (Array.isArray(category.macro) ? category.macro[0] : null);
                            if (!categoryGroup) return false;
                            
                            // Filter by transaction type
                            if (transactionType === "expense") {
                              if (categoryGroup.type !== "expense" && categoryGroup.type !== null) return false;
                            } else if (transactionType === "income") {
                              if (categoryGroup.type !== "income" && categoryGroup.type !== null) return false;
                            }
                            
                            // Filter by selected group
                            if (selectedFilterGroupId !== null && categoryGroup.id !== selectedFilterGroupId) {
                              return false;
                            }
                            
                            return true;
                          });

                        if (filteredCategories.length === 0) {
                          return (
                            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                              No categories found.
                            </div>
                          );
                        }

                        // If a group is selected, show categories directly (no grouping)
                        // Otherwise, group categories by Group
                        if (selectedFilterGroupId !== null) {
                          // Show categories directly when a group is selected
                          const sortedCategories = filteredCategories.sort((a, b) => a.name.localeCompare(b.name));
                          
                          return (
                            <>
                              {sortedCategories.map((category) => (
                                <SelectItem key={category.id} value={category.id}>
                                  {category.name}
                                </SelectItem>
                              ))}
                              {canCreateCategory && (
                                <>
                                  <SelectSeparator />
                                  <SelectItem 
                                    value="__add_category__"
                                    className="text-foreground font-medium"
                                  >
                                    <Plus className="mr-2 h-4 w-4 inline" />
                                    Add Category
                                  </SelectItem>
                                </>
                              )}
                            </>
                          );
                        } else {
                          // Group categories by Group when no filter is selected
                          const groupedByGroup = new Map<string, { group: any; categories: Category[] }>();
                          filteredCategories.forEach((category) => {
                            // Use group first, then macro for backward compatibility
                            const categoryGroup = category.group || category.macro || 
                                                 (Array.isArray(category.group) ? category.group[0] : null) ||
                                                 (Array.isArray(category.macro) ? category.macro[0] : null);
                            if (categoryGroup) {
                              const groupId = categoryGroup.id;
                              if (!groupedByGroup.has(groupId)) {
                                groupedByGroup.set(groupId, { group: categoryGroup, categories: [] });
                              }
                              groupedByGroup.get(groupId)!.categories.push(category);
                            }
                          });

                          // Sort groups by name
                          const sortedGroups = Array.from(groupedByGroup.entries()).sort((a, b) => 
                            a[1].group.name.localeCompare(b[1].group.name)
                          );

                          return (
                            <>
                              {sortedGroups.map(([groupId, { group, categories }]) => (
                                <SelectGroup key={groupId}>
                                  <SelectLabel>{group.name}</SelectLabel>
                                  {categories
                                    .sort((a, b) => a.name.localeCompare(b.name))
                                    .map((category) => (
                                      <SelectItem key={category.id} value={category.id}>
                                        {category.name}
                                      </SelectItem>
                                    ))}
                                </SelectGroup>
                              ))}
                              {canCreateCategory && (
                                <>
                                  <SelectSeparator />
                                  <SelectItem 
                                    value="__add_category__"
                                    className="text-foreground font-medium"
                                  >
                                    <Plus className="mr-2 h-4 w-4 inline" />
                                    Add Category
                                  </SelectItem>
                                </>
                              )}
                            </>
                          );
                        }
                      })()}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.categoryId && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.categoryId.message}
                    </p>
                  )}
                </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium">
                      Subcategory <span className="text-gray-400 text-[12px]">(optional)</span>
                    </label>
                    <Select
                      value={form.watch("subcategoryId") || ""}
                      onValueChange={handleSubcategoryChange}
                      disabled={!selectedCategoryId || (subcategoriesMap.get(selectedCategoryId) || []).length === 0}
                    >
                      <SelectTrigger size="small">
                        <SelectValue placeholder={
                          !selectedCategoryId 
                            ? "Select a category first" 
                            : (subcategoriesMap.get(selectedCategoryId) || []).length === 0
                            ? "No subcategories available"
                            : "Select a subcategory"
                        } />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          // Filter subcategories by selected group if a group is selected
                          let subcats = selectedCategoryId ? subcategoriesMap.get(selectedCategoryId) || [] : [];
                          
                          // If a group is selected, filter subcategories to only show those from categories in that group
                          if (selectedFilterGroupId !== null && selectedCategoryId) {
                            const category = allCategories.find(c => c.id === selectedCategoryId);
                            if (category) {
                              const categoryGroup = category.group || category.macro || 
                                                   (Array.isArray(category.group) ? category.group[0] : null) ||
                                                   (Array.isArray(category.macro) ? category.macro[0] : null);
                              // Only show subcategories if the category belongs to the selected group
                              if (categoryGroup?.id !== selectedFilterGroupId) {
                                subcats = [];
                              }
                            }
                          }
                          
                          if (!selectedCategoryId) {
                            return (
                              <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                                Select a category first
                              </div>
                            );
                          }
                          
                          if (subcats.length === 0) {
                            return (
                              <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                                No subcategories found for this category
                              </div>
                            );
                          }
                          
                          return subcats.map((subcategory) => (
                            <SelectItem key={subcategory.id} value={subcategory.id}>
                              {subcategory.name}
                            </SelectItem>
                          ));
                        })()}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================
                2) SECONDARY FIELDS (Optional - visible by default)
                ============================================ */}
            
            {/* Description and Merchant row */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Description</label>
                <Input size="small" {...form.register("description")} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  Merchant <span className="text-gray-400 text-[12px]">(optional)</span>
                </label>
                <Input size="small" {...form.register("merchant")} placeholder="Store name" />
              </div>
            </div>

            {/* Receipt Download Button */}
            {receiptUrl && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Receipt</label>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    window.open(receiptUrl, '_blank');
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Receipt
                </Button>
              </div>
            )}

            {/* ============================================
                3) ADVANCED FIELDS (Rarely used - collapsed by default)
                ============================================ */}
            
            <Accordion type="single" collapsible defaultValue="">
              <AccordionItem value="more-options">
                <AccordionTrigger>More Options</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    {/* Expense Type (only for expense transactions) */}
                    {form.watch("type") === "expense" && (
                      <div className="space-y-3">
                        <label className="text-sm font-medium">
                          Expense Type <span className="text-gray-400 text-[12px]">(optional)</span>
                        </label>
                        <div className="flex gap-6">
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="radio"
                              name="expenseType"
                              value="variable"
                              checked={form.watch("expenseType") === "variable"}
                              onChange={() => {
                                form.setValue("expenseType", "variable");
                              }}
                              className="w-4 h-4 text-primary border-border focus:ring-primary"
                            />
                            <span className="text-sm">Variable</span>
                          </label>
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="radio"
                              name="expenseType"
                              value="fixed"
                              checked={form.watch("expenseType") === "fixed"}
                              onChange={() => {
                                form.setValue("expenseType", "fixed");
                              }}
                              className="w-4 h-4 text-primary border-border focus:ring-primary"
                            />
                            <span className="text-sm">Fixed</span>
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Recurring */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Switch
                          id="recurring"
                          checked={form.watch("recurring")}
                          onCheckedChange={(checked) => {
                            form.setValue("recurring", checked);
                            if (!checked) {
                              form.setValue("recurringFrequency", undefined);
                            } else if (!form.watch("recurringFrequency")) {
                              form.setValue("recurringFrequency", "monthly");
                            }
                          }}
                        />
                        <label
                          htmlFor="recurring"
                          className="text-sm font-medium cursor-pointer flex items-center"
                        >
                          Repeat this payment
                        </label>
                      </div>
                      
                      {form.watch("recurring") && (() => {
                        const frequencyOptions = {
                          daily: { label: "Daily", description: "Daily repetition" },
                          weekly: { label: "Weekly", description: "Every 7 days" },
                          biweekly: { label: "Biweekly", description: "Every 14 days" },
                          monthly: { label: "Monthly", description: "Once per month" },
                          semimonthly: { label: "Semimonthly", description: "Twice per month" },
                          quarterly: { label: "Quarterly", description: "Every 3 months" },
                          semiannual: { label: "Semiannual", description: "Every 6 months" },
                          annual: { label: "Annual", description: "Once per year" },
                        } as const;

                        const selectedFrequency = form.watch("recurringFrequency") || "monthly";

                        return (
                          <div className="space-y-2">
                            <label htmlFor="recurringFrequency" className="text-sm text-muted-foreground">
                              Frequency
                            </label>
                            <Select
                              value={selectedFrequency}
                              onValueChange={(value) => {
                                form.setValue("recurringFrequency", value as any);
                              }}
                            >
                              <SelectTrigger id="recurringFrequency">
                                <SelectValue placeholder="Select frequency" />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(frequencyOptions).map(([value, option]) => (
                                  <SelectItem key={value} value={value}>
                                    <div className="flex items-center gap-2 w-full">
                                      <span className="font-medium">{option.label}</span>
                                      <span className="text-xs text-muted-foreground">{option.description}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* Show banner if date is future */}
            {!transaction && (() => {
              const transactionDate = form.watch("date");
              const date = transactionDate instanceof Date ? transactionDate : new Date(transactionDate);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              date.setHours(0, 0, 0, 0);
              const isFuture = date > today;
              
              if (isFuture) {
                return (
                  <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
                      This transaction will be automatically saved as a <strong>Planned Payment</strong> and won't affect your current balance.
                    </AlertDescription>
                  </Alert>
                );
              }
              return null;
            })()}
          </div>

          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            {!transaction && (
              <Button 
                type="button" 
                variant="outline"
                disabled={isSubmitting}
                onClick={(e) => {
                  e.preventDefault();
                  form.handleSubmit(onSubmitAndNew, (errors) => {
                    console.log("[TransactionForm] Validation errors", errors);
                    
                    // Build detailed error message
                    const errorMessages = Object.entries(errors).map(([field, error]) => {
                      if (error && 'message' in error) {
                        return `${field}: ${error.message}`;
                      }
                      return `${field}: Invalid value`;
                    });
                    
                    const errorMessage = errorMessages.length > 0 
                      ? errorMessages.join(', ')
                      : "Please check the form fields and try again.";
                    
                    toast({
                      title: "Validation Error",
                      description: errorMessage,
                      variant: "destructive",
                    });
                  })();
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save and New"
                )}
              </Button>
            )}
            <Button 
              type="submit" 
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      </Dialog>
      )}

      {/* Add Category Dialog */}
      <Dialog 
        open={showAddCategoryDialog} 
        onOpenChange={(open) => {
          setShowAddCategoryDialog(open);
          if (!open) {
            // Reset form when dialog closes
            setNewCategoryName("");
            setSelectedGroupId("");
          } else {
            // Reload groups when dialog opens to ensure we have the latest filtered list
            loadAvailableGroups();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Category</DialogTitle>
            <DialogDescription>
              Create a new category for {form.watch("type") === "expense" ? "expenses" : "income"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Group</label>
              <Select
                value={selectedGroupId}
                onValueChange={setSelectedGroupId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a group" />
                </SelectTrigger>
                <SelectContent>
                  {availableGroups.length > 0 ? (
                    availableGroups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No groups available for {form.watch("type") === "expense" ? "expenses" : "income"}
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Category Name</label>
              <Input
                placeholder="Enter category name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newCategoryName.trim() && selectedGroupId) {
                    e.preventDefault();
                    handleCreateCategory();
                  }
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowAddCategoryDialog(false);
                setNewCategoryName("");
                setSelectedGroupId("");
              }}
              disabled={isCreatingCategory}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateCategory}
              disabled={!newCategoryName.trim() || !selectedGroupId || isCreatingCategory}
            >
              {isCreatingCategory ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Receipt Scanner */}
      <ReceiptScanner
        open={isReceiptScannerOpen}
        onOpenChange={setIsReceiptScannerOpen}
        onScanComplete={(data) => {
          // Pre-fill form with receipt data
          if (data.amount) {
            form.setValue("amount", data.amount);
          }
          if (data.merchant) {
            form.setValue("merchant", data.merchant);
          }
          if (data.description) {
            form.setValue("description", data.description);
          } else if (data.merchant) {
            // Use merchant as description if no description provided
            form.setValue("description", data.merchant);
          }
          if (data.date) {
            try {
              const date = new Date(data.date);
              if (!isNaN(date.getTime())) {
                form.setValue("date", date);
              }
            } catch (e) {
              // Invalid date, ignore
            }
          }
          // Set type to expense by default for receipts
          form.setValue("type", "expense");
          // Save receipt URL if available
          if (data.receiptUrl) {
            setReceiptUrl(data.receiptUrl);
          }
        }}
      />
    </>
  );
}

