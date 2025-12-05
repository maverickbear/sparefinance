"use client";

import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { debtSchema, DebtFormData } from "@/src/domain/debts/debts.validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoney } from "@/components/common/money";
import { formatTransactionDate, parseDateInput, formatDateInput } from "@/src/infrastructure/utils/timestamp";
import { DollarAmountInput } from "@/components/common/dollar-amount-input";
import { PercentageInput } from "@/components/common/percentage-input";
import { DatePicker } from "@/components/ui/date-picker";
import { calculateDebtMetrics, convertToMonthlyPayment, convertFromMonthlyPayment, calculateMonthlyPayment, calculatePaymentsFromDate, type DebtForCalculation } from "@/lib/utils/debts";
import { useToast } from "@/components/toast-provider";
import { Loader2 } from "lucide-react";
import { AccountRequiredDialog } from "@/components/common/account-required-dialog";
// Using API routes instead of client-side APIs
import type { Category } from "@/src/domain/categories/categories.types";

interface Debt {
  id: string;
  name: string;
  loanType: string;
  initialAmount: number;
  downPayment: number;
  currentBalance: number;
  interestRate: number;
  totalMonths: number | null;
  firstPaymentDate: string;
  startDate?: string | null;
  monthlyPayment: number;
  paymentFrequency?: string;
  paymentAmount?: number | null;
  principalPaid: number;
  interestPaid: number;
  additionalContributions: boolean;
  additionalContributionAmount?: number | null;
  priority: "High" | "Medium" | "Low";
  description?: string | null;
  accountId?: string | null;
  isPaused: boolean;
  isPaidOff: boolean;
  createdAt?: string;
  updatedAt?: string;
  monthsRemaining?: number | null;
  totalInterestRemaining?: number;
  progressPct?: number;
}

interface DebtFormProps {
  debt?: Debt;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
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

// Helper function to map category/subcategory name to valid loanType values
function mapToValidLoanType(name: string): "mortgage" | "car_loan" | "personal_loan" | "credit_card" | "student_loan" | "business_loan" | "other" {
  const nameLower = name.toLowerCase();
  
  if (nameLower.includes("mortgage") || nameLower.includes("home")) {
    return "mortgage";
  } else if (nameLower.includes("car") || nameLower.includes("auto") || nameLower.includes("vehicle")) {
    return "car_loan";
  } else if (nameLower.includes("personal")) {
    return "personal_loan";
  } else if (nameLower.includes("credit") || nameLower.includes("card")) {
    return "credit_card";
  } else if (nameLower.includes("student") || nameLower.includes("education")) {
    return "student_loan";
  } else if (nameLower.includes("business")) {
    return "business_loan";
  }
  
  return "other";
}

export function DebtForm({
  debt,
  open,
  onOpenChange,
  onSuccess,
}: DebtFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forecast, setForecast] = useState<{
    monthsRemaining: number | null;
    totalInterestRemaining: number;
    progressPct: number;
  } | null>(null);
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [shouldShowForm, setShouldShowForm] = useState(false);
  const [debtsCategories, setDebtsCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>("");
  
  const isInitialLoad = useRef(false);
  const isDataLoaded = useRef(false);
  const isPaymentAmountManuallyEdited = useRef(false);
  const isPrincipalPaidManuallyEdited = useRef(false);

  const form = useForm<DebtFormData>({
    resolver: zodResolver(debtSchema),
    defaultValues: {
      name: "",
      loanType: undefined,
      initialAmount: 0,
      downPayment: 0,
      currentBalance: 0,
      interestRate: 0,
      totalMonths: 0,
      firstPaymentDate: new Date(),
      startDate: new Date(),
      paymentFrequency: "monthly",
      paymentAmount: 0,
      monthlyPayment: 0,
      principalPaid: 0,
      interestPaid: 0,
      additionalContributions: false,
      additionalContributionAmount: 0,
      priority: "Medium",
      description: "",
      isPaused: false,
    },
  });

  // Watch values for calculations
  const initialAmount = form.watch("initialAmount");
  const downPayment = form.watch("downPayment");
  const principalPaid = form.watch("principalPaid");
  const currentBalance = form.watch("currentBalance");
  const interestRate = form.watch("interestRate");
  const totalMonths = form.watch("totalMonths");
  const paymentFrequency = form.watch("paymentFrequency");
  const paymentAmount = form.watch("paymentAmount");
  const monthlyPayment = form.watch("monthlyPayment");
  const additionalContributions = form.watch("additionalContributions");
  const additionalContributionAmount = form.watch("additionalContributionAmount");
  const isPaused = form.watch("isPaused");
  const firstPaymentDate = form.watch("firstPaymentDate");
  const startDate = form.watch("startDate");
  const loanType = form.watch("loanType");

  // Helper functions for loan type specific configurations
  const getFieldConfig = () => {
    const type = loanType || "";
    const typeLower = type.toLowerCase();
    
    // Check if it's a credit card (by checking if loanType contains "credit" or "card")
    const isCreditCard = typeLower.includes("credit") || typeLower.includes("card");
    
    // Default configuration
    const defaultConfig = {
      showDownPayment: true,
      downPaymentRequired: false,
      showTotalMonths: true,
      totalMonthsRequired: true,
      showPaymentFrequency: true,
      paymentFrequencyLocked: false,
      paymentFrequencyDefault: "monthly",
      initialAmountLabel: "Original Amount",
      startDateLabel: "Start Date",
      firstPaymentDateLabel: "First Payment Date",
      paymentAmountLabel: "Payment Amount",
      totalMonthsPresets: [12, 24, 36, 48, 60, 72, 84, 96, 120, 180, 240, 300, 360],
    };
    
    // Credit card configuration
    if (isCreditCard) {
      return {
        showDownPayment: false,
        downPaymentRequired: false,
        showTotalMonths: false,
        totalMonthsRequired: false,
        showPaymentFrequency: true,
        paymentFrequencyLocked: true,
        paymentFrequencyDefault: "monthly",
        initialAmountLabel: "Current Balance",
        startDateLabel: "Statement Start Date",
        firstPaymentDateLabel: "Next Due Date",
        paymentAmountLabel: "Planned Monthly Payment",
        totalMonthsPresets: [],
      };
    }
    
    // Try to match known loan types for presets
    const configs: Record<string, {
      showDownPayment: boolean;
      downPaymentRequired: boolean;
      showTotalMonths: boolean;
      totalMonthsRequired: boolean;
      showPaymentFrequency: boolean;
      paymentFrequencyLocked: boolean;
      paymentFrequencyDefault: string;
      initialAmountLabel: string;
      startDateLabel: string;
      firstPaymentDateLabel: string;
      paymentAmountLabel: string;
      totalMonthsPresets: number[];
    }> = {
      mortgage: {
        ...defaultConfig,
        totalMonthsPresets: [300, 360],
      },
      car_loan: {
        ...defaultConfig,
        totalMonthsPresets: [24, 36, 48, 60, 72, 84],
      },
      personal_loan: {
        ...defaultConfig,
        totalMonthsPresets: [12, 24, 36, 48, 60],
      },
      student_loan: {
        ...defaultConfig,
        totalMonthsPresets: [120, 180, 240, 300, 360],
      },
      business_loan: {
        ...defaultConfig,
        totalMonthsPresets: [12, 24, 36, 48, 60, 72, 84, 96, 120],
      },
    };
    
    // Try to find matching config by checking if type contains known keywords
    for (const [key, config] of Object.entries(configs)) {
      if (typeLower.includes(key.replace("_", " ")) || typeLower === key) {
        return config;
      }
    }
    
    return defaultConfig;
  };

  const fieldConfig = getFieldConfig();

  // Set payment frequency to monthly for credit cards
  useEffect(() => {
    const typeLower = (loanType || "").toLowerCase();
    const isCreditCard = typeLower.includes("credit") || typeLower.includes("card");
    if (isCreditCard && form.watch("paymentFrequency") !== "monthly") {
      form.setValue("paymentFrequency", "monthly", { shouldValidate: false });
    }
  }, [loanType, form]);

  // Get total months options based on loan type
  const getTotalMonthsOptions = () => {
    const typeLower = (loanType || "").toLowerCase();
    const isCreditCard = typeLower.includes("credit") || typeLower.includes("card");
    if (isCreditCard) {
      return [];
    }
    
    const presets = fieldConfig.totalMonthsPresets;
    const allOptions = [6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 72, 84, 96, 108, 120, 144, 180, 240, 300, 360];
    
    // If we have specific presets, show those plus common options
    if (presets.length > 0) {
      const combined = [...new Set([...presets, ...allOptions])].sort((a, b) => a - b);
      return combined;
    }
    
    return allOptions;
  };

  // Calculate payment amount automatically based on initial amount, down payment, interest rate, total months, and payment frequency
  useEffect(() => {
    if (!open) {
      return;
    }
    
    // Don't calculate during initial data load
    if (!isDataLoaded.current) {
      return;
    }
    
    // Reset manual edit flag when base values change significantly
    // This allows recalculation when user changes the loan parameters
    if (initialAmount || downPayment || interestRate || totalMonths || paymentFrequency) {
      // Only reset if we're about to recalculate (not if user just edited payment amount)
      // We'll check this by seeing if the current payment amount matches what we'd calculate
    }
    
    // Treat empty values as 0
    const effectiveInitialAmount = initialAmount || 0;
    const effectiveInterestRate = interestRate || 0;
    const effectiveDownPayment = downPayment || 0;
    
    // Only calculate if we have all required values
    if (effectiveInitialAmount > 0 && totalMonths && totalMonths > 0 && paymentFrequency) {
      const principal = effectiveInitialAmount - effectiveDownPayment;
      
      if (principal > 0) {
        // Calculate monthly payment using amortization formula
        const calculatedMonthlyPayment = calculateMonthlyPayment(
          principal,
          effectiveInterestRate,
          totalMonths
        );
        
        // Convert monthly payment to payment amount based on frequency
        const calculatedPaymentAmount = convertFromMonthlyPayment(
          calculatedMonthlyPayment,
          paymentFrequency as "monthly" | "biweekly" | "weekly" | "semimonthly" | "daily"
        );
        
        // Only update if the calculated value is different from current
        const currentPaymentAmount = form.getValues("paymentAmount");
        
        // If the calculated value is significantly different, reset manual edit flag and recalculate
        if (currentPaymentAmount !== undefined && Math.abs(calculatedPaymentAmount - currentPaymentAmount) > 0.01) {
          // If user manually edited, but the base values changed, allow recalculation
          if (isPaymentAmountManuallyEdited.current) {
            // Check if this is due to base value changes (not just initial load)
            // If calculated value is very different, it's likely due to base value changes
            const difference = Math.abs(calculatedPaymentAmount - currentPaymentAmount);
            const percentageDifference = currentPaymentAmount > 0 
              ? (difference / currentPaymentAmount) * 100 
              : 100;
            
            // If difference is more than 5%, likely due to base value changes, allow recalculation
            if (percentageDifference > 5) {
              isPaymentAmountManuallyEdited.current = false;
            }
          }
          
          // Only update if not manually edited (or if we just reset the flag)
          if (!isPaymentAmountManuallyEdited.current) {
            form.setValue("paymentAmount", calculatedPaymentAmount, { shouldValidate: false });
            form.setValue("monthlyPayment", calculatedMonthlyPayment, { shouldValidate: false });
          }
        }
      } else if (effectiveInitialAmount === 0 || effectiveInterestRate === 0) {
        // If amount or interest is 0, set payment amount to 0
        if (!isPaymentAmountManuallyEdited.current) {
          form.setValue("paymentAmount", 0, { shouldValidate: false });
          form.setValue("monthlyPayment", 0, { shouldValidate: false });
        }
      }
    } else if (effectiveInitialAmount === 0 || !totalMonths || totalMonths === 0 || !paymentFrequency) {
      // If required values are missing, set payment amount to 0
      if (!isPaymentAmountManuallyEdited.current) {
        form.setValue("paymentAmount", 0, { shouldValidate: false });
        form.setValue("monthlyPayment", 0, { shouldValidate: false });
      }
    }
  }, [initialAmount, downPayment, interestRate, totalMonths, paymentFrequency, form, open]);

  // Calculate monthly payment from paymentAmount and frequency
  // Only calculate when user manually changes values (not during initial load)
  useEffect(() => {
    if (!open) {
      return;
    }
    
    // Don't calculate during initial data load
    if (!isDataLoaded.current) {
      return;
    }
    
    // Only calculate if user has entered values
    if (paymentAmount && paymentAmount > 0 && paymentFrequency) {
      const calculatedMonthly = convertToMonthlyPayment(
        paymentAmount,
        paymentFrequency as "monthly" | "biweekly" | "weekly" | "semimonthly" | "daily"
      );
      // Only update if the calculated value is different from current
      const currentMonthly = form.getValues("monthlyPayment");
      if (currentMonthly !== undefined && Math.abs(calculatedMonthly - currentMonthly) > 0.01) {
        form.setValue("monthlyPayment", calculatedMonthly, { shouldValidate: false });
      }
    }
  }, [paymentAmount, paymentFrequency, form, open]);

  // Calculate principal paid automatically based on first payment date
  useEffect(() => {
    if (!open) {
      return;
    }
    
    // Don't calculate during initial data load
    if (!isDataLoaded.current) {
      return;
    }
    
    // Don't calculate if user manually edited principal paid
    if (isPrincipalPaidManuallyEdited.current) {
      return;
    }
    
    // Only calculate if we have all required values
    const effectiveInitialAmount = initialAmount || 0;
    const effectiveDownPayment = downPayment || 0;
    const effectiveInterestRate = interestRate || 0;
    const effectiveTotalMonths = totalMonths || 0;
    const effectivePaymentFrequency = paymentFrequency;
    const effectivePaymentAmount = paymentAmount || 0;
    const effectiveMonthlyPayment = monthlyPayment || 0;
    const effectiveAdditionalContributions = additionalContributions || false;
    const effectiveAdditionalContributionAmount = additionalContributionAmount || 0;
    
    if (effectiveInitialAmount > 0 && effectiveTotalMonths > 0 && effectivePaymentFrequency && firstPaymentDate) {
      // Create debt object for calculation
      const debtForCalculation: DebtForCalculation = {
        id: debt?.id || "",
        name: debt?.name || "",
        initialAmount: effectiveInitialAmount,
        downPayment: effectiveDownPayment,
        currentBalance: currentBalance || 0,
        interestRate: effectiveInterestRate,
        totalMonths: effectiveTotalMonths,
        firstPaymentDate: firstPaymentDate instanceof Date ? firstPaymentDate : new Date(firstPaymentDate),
        monthlyPayment: effectiveMonthlyPayment,
        paymentFrequency: effectivePaymentFrequency as "monthly" | "biweekly" | "weekly" | "semimonthly" | "daily",
        paymentAmount: effectivePaymentAmount,
        principalPaid: principalPaid || 0,
        interestPaid: 0,
        additionalContributions: effectiveAdditionalContributions,
        additionalContributionAmount: effectiveAdditionalContributionAmount,
        priority: debt?.priority || "Medium",
        isPaused: isPaused || false,
        isPaidOff: false,
        description: debt?.description || null,
      };
      
      // Calculate payments from date
      const calculatedPayments = calculatePaymentsFromDate(debtForCalculation);
      
      // Update principal paid, interest paid, and current balance
      const currentPrincipalPaid = form.getValues("principalPaid") || 0;
      if (Math.abs(calculatedPayments.principalPaid - currentPrincipalPaid) > 0.01) {
        form.setValue("principalPaid", calculatedPayments.principalPaid, { shouldValidate: false });
        form.setValue("interestPaid", calculatedPayments.interestPaid, { shouldValidate: false });
        form.setValue("currentBalance", calculatedPayments.currentBalance, { shouldValidate: false });
      }
    }
  }, [
    open,
    initialAmount,
    downPayment,
    interestRate,
    totalMonths,
    paymentFrequency,
    paymentAmount,
    monthlyPayment,
    additionalContributions,
    additionalContributionAmount,
    firstPaymentDate,
    isPaused,
    form,
    debt,
    currentBalance,
    principalPaid,
  ]);

  // Calculate forecast when values change
  useEffect(() => {
    if (!open) {
      return;
    }

    if (!initialAmount || initialAmount <= 0) {
      setForecast(null);
      return;
    }

    // Debounce to avoid excessive calculations
    const timeoutId = setTimeout(() => {
      try {
        const effectiveDownPayment = downPayment || 0;
        const effectivePrincipalPaid = principalPaid || 0;
        const effectiveCurrentBalance = currentBalance || 0;
        const effectiveInterestRate = interestRate || 0;
        const effectiveMonthlyPayment = monthlyPayment || 0;
        const effectiveAdditionalContribution = additionalContributions && additionalContributionAmount
          ? additionalContributionAmount
          : 0;

        // Calculate current balance if not set
        const calculatedBalance = effectiveCurrentBalance > 0
          ? effectiveCurrentBalance
          : initialAmount - effectiveDownPayment - effectivePrincipalPaid;

        const debtForCalculation: DebtForCalculation = {
          id: debt?.id || "",
          name: debt?.name || "",
          initialAmount,
          downPayment: effectiveDownPayment,
          currentBalance: calculatedBalance,
          interestRate: effectiveInterestRate,
          totalMonths: totalMonths || 0,
          firstPaymentDate: debt?.firstPaymentDate || new Date(),
          monthlyPayment: effectiveMonthlyPayment,
          principalPaid: effectivePrincipalPaid,
          interestPaid: debt?.interestPaid || 0,
          additionalContributions: additionalContributions || false,
          additionalContributionAmount: effectiveAdditionalContribution,
          priority: debt?.priority || "Medium",
          isPaused: isPaused || false,
          isPaidOff: false,
          description: debt?.description || null,
        };

        const metrics = calculateDebtMetrics(debtForCalculation);

        setForecast({
          monthsRemaining: metrics.monthsRemaining,
          totalInterestRemaining: metrics.totalInterestRemaining,
          progressPct: metrics.progressPct,
        });
      } catch (error) {
        console.error("Error calculating forecast:", error);
        setForecast(null);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [
    initialAmount,
    downPayment,
    principalPaid,
    currentBalance,
    interestRate,
    totalMonths,
    monthlyPayment,
    additionalContributions,
    additionalContributionAmount,
    isPaused,
    open,
    debt,
  ]);

  // Load accounts and debts categories
  useEffect(() => {
    if (open) {
      loadAccounts();
      loadDebtsCategories();
    }
  }, [open]);

  // Map loanType to category/subcategory when editing a debt and categories are loaded
  useEffect(() => {
    if (debt && debt.id && debtsCategories.length > 0 && debt.loanType && !selectedCategoryId) {
      const loanTypeLower = debt.loanType.toLowerCase().replace(/_/g, " ");
      // Try to find category or subcategory that matches
      for (const category of debtsCategories) {
        if (category.name.toLowerCase() === loanTypeLower) {
          setSelectedCategoryId(category.id);
          return;
        }
        // Check subcategories
        if (category.subcategories) {
          const matchingSub = category.subcategories.find(
            (sub) => sub.name.toLowerCase() === loanTypeLower
          );
          if (matchingSub) {
            setSelectedCategoryId(category.id);
            setSelectedSubcategoryId(matchingSub.id);
            return;
          }
        }
      }
    }
  }, [debt, debtsCategories, selectedCategoryId]);

  async function loadDebtsCategories() {
    try {
      // OPTIMIZED: Single API call to get both groups and categories using v2 API route
      const response = await fetch("/api/v2/categories?consolidated=true");
      if (!response.ok) {
        throw new Error("Failed to fetch categories data");
      }
      const { groups: macros, categories: allCategories } = await response.json();
      
      // Find the "Debts" group
      const debtsGroup = macros?.find((macro: any) => macro.name.toLowerCase() === "debts");
      if (!debtsGroup) {
        console.warn("Debts group not found");
        setDebtsCategories([]);
        return;
      }
      
      // Filter categories that belong to the Debts group
      const debtsCategoriesList = (allCategories || []).filter(
        (cat: any) => cat.groupId === debtsGroup.id
      );
      
      setDebtsCategories(debtsCategoriesList);
    } catch (error) {
      console.error("Error loading debts categories:", error);
      // Fallback to API routes if consolidated endpoint fails
      try {
        const [categoriesResponse, groupsResponse] = await Promise.all([
          fetch("/api/v2/categories?all=true"),
          fetch("/api/v2/categories"),
        ]);
        if (!categoriesResponse.ok || !groupsResponse.ok) {
          throw new Error("Failed to fetch categories");
        }
        const [allCategories, macros] = await Promise.all([
          categoriesResponse.json(),
          groupsResponse.json(),
        ]);
        const debtsGroup = macros.find((macro: any) => macro.name.toLowerCase() === "debts");
        if (debtsGroup) {
          const debtsCategoriesList = allCategories.filter(
            (cat: any) => cat.groupId === debtsGroup.id
          );
          setDebtsCategories(debtsCategoriesList);
        }
      } catch (fallbackError) {
        console.error("Error in fallback loading:", fallbackError);
      setDebtsCategories([]);
      }
    }
  }

  // Check accounts when opening form for new debt
  useEffect(() => {
    if (open) {
      // If editing a debt, no need to check accounts
      if (debt) {
        setShouldShowForm(true);
        loadAccounts();
      } else {
        // If creating a new debt, check if there are accounts
        checkAccountsAndShowForm();
      }
    } else {
      setShouldShowForm(false);
      setShowAccountDialog(false);
    }
  }, [open, debt]);

  async function checkAccountsAndShowForm() {
    try {
      // OPTIMIZED: Skip investment balances calculation (not needed for debt form)
      const accountsRes = await fetch("/api/v2/accounts?includeHoldings=false");
      if (accountsRes.ok) {
        const accountsData = await accountsRes.json().catch(() => []);
        if (accountsData.length === 0) {
          // No accounts, show the dialog
          setShowAccountDialog(true);
          setShouldShowForm(false);
        } else {
          // Has accounts, can show the form
          setShouldShowForm(true);
          loadAccounts();
        }
      } else {
        // Error fetching accounts, try to show the form anyway
        setShouldShowForm(true);
        loadAccounts();
      }
    } catch (error) {
      console.error("Error checking accounts:", error);
      // In case of error, try to show the form anyway
      setShouldShowForm(true);
      loadAccounts();
    }
  }

  async function loadAccounts() {
    try {
      // OPTIMIZED: Skip investment balances calculation (not needed for debt form)
      const res = await fetch("/api/v2/accounts?includeHoldings=false");
      const data = await res.json();
      setAccounts(data || []);
    } catch (error) {
      console.error("Error loading accounts:", error);
    }
  }

  // Load debt data when editing
  useEffect(() => {
    if (!open) {
      // Reset form when dialog closes
      isInitialLoad.current = false;
      isDataLoaded.current = false;
      isPaymentAmountManuallyEdited.current = false;
      isPrincipalPaidManuallyEdited.current = false;
      setSelectedCategoryId("");
      setSelectedSubcategoryId("");
      form.reset();
      return;
    }

    // Only load data once when dialog opens
    if (isInitialLoad.current) {
      return;
    }

    isInitialLoad.current = true;
    isDataLoaded.current = false;

    if (debt && debt.id) {
      // Parse firstPaymentDate - handle both string and Date
      let firstPaymentDateValue: Date;
      if (debt.firstPaymentDate) {
        if (typeof debt.firstPaymentDate === 'string') {
          const parsedDate = new Date(debt.firstPaymentDate);
          firstPaymentDateValue = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
        } else {
          // Handle case where it might be a Date object from database
          const dateValue = debt.firstPaymentDate as any;
          firstPaymentDateValue = dateValue instanceof Date 
            ? dateValue 
            : new Date(dateValue);
        }
      } else {
        firstPaymentDateValue = new Date();
      }

      // Parse startDate - handle both string and Date
      let startDateValue: Date;
      const debtStartDate = (debt as any).startDate;
      if (debtStartDate) {
        if (typeof debtStartDate === 'string') {
          const parsedDate = new Date(debtStartDate);
          startDateValue = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
        } else {
          const dateValue = debtStartDate as any;
          startDateValue = dateValue instanceof Date 
            ? dateValue 
            : new Date(dateValue);
        }
      } else {
        startDateValue = firstPaymentDateValue; // Default to first payment date if not set
      }

      form.reset({
        name: debt.name ?? "",
        loanType: (debt.loanType ?? "other") as "other" | "car_loan" | "mortgage" | "personal_loan" | "credit_card" | "student_loan" | "business_loan",
        initialAmount: debt.initialAmount ?? 0,
        downPayment: debt.downPayment ?? 0,
        currentBalance: debt.currentBalance ?? 0,
        interestRate: debt.interestRate ?? 0,
        totalMonths: debt.totalMonths ?? ((debt.loanType?.toLowerCase().includes("credit") || debt.loanType?.toLowerCase().includes("card")) ? null : 0),
        firstPaymentDate: firstPaymentDateValue,
        startDate: startDateValue,
        paymentFrequency: (debt as any).paymentFrequency ?? "monthly",
        paymentAmount: (debt as any).paymentAmount ?? 0,
        monthlyPayment: debt.monthlyPayment ?? 0,
        principalPaid: debt.principalPaid ?? 0,
        interestPaid: debt.interestPaid ?? 0,
        additionalContributions: debt.additionalContributions ?? false,
        additionalContributionAmount: debt.additionalContributionAmount ?? 0,
        priority: debt.priority ?? "Medium",
        description: debt.description ?? "",
        accountId: (debt as any).accountId ?? undefined,
        isPaused: debt.isPaused ?? false,
      });
      
      // Mark data as loaded after a short delay to allow form to settle
      setTimeout(() => {
        isDataLoaded.current = true;
      }, 100);
      } else {
        // New debt - reset to defaults
        form.reset({
          name: "",
          loanType: undefined,
          initialAmount: 0,
          downPayment: 0,
          currentBalance: 0,
          interestRate: 0,
          totalMonths: null,
          firstPaymentDate: new Date(),
          startDate: new Date(),
          paymentFrequency: "monthly",
          paymentAmount: 0,
          monthlyPayment: 0,
          principalPaid: 0,
          interestPaid: 0,
          additionalContributions: false,
          additionalContributionAmount: 0,
          priority: "Medium",
          description: "",
          accountId: undefined,
          isPaused: false,
        });
        
        // Reset category selections
        setSelectedCategoryId("");
        setSelectedSubcategoryId("");
      
      // Mark data as loaded for new debt too
      setTimeout(() => {
        isDataLoaded.current = true;
      }, 100);
    }
  }, [open, debt?.id, form]);

  async function onSubmit(data: DebtFormData) {
    try {
      setIsSubmitting(true);
      // Calculate initial balance
      const calculatedBalance = (data.currentBalance !== undefined && data.currentBalance > 0)
        ? data.currentBalance
        : data.initialAmount - (data.downPayment ?? 0) - (data.principalPaid ?? 0);

      // Convert firstPaymentDate to ISO string for API
      const firstPaymentDateValue = data.firstPaymentDate instanceof Date
        ? data.firstPaymentDate.toISOString()
        : data.firstPaymentDate;

      // Convert startDate to ISO string for API
      const startDateValue = data.startDate instanceof Date
        ? data.startDate.toISOString()
        : data.startDate;

      if (debt) {
        // Update existing debt
        const res = await fetch(`/api/v2/debts/${debt.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: data.name,
              loanType: data.loanType,
              initialAmount: data.initialAmount,
              downPayment: data.downPayment,
              currentBalance: calculatedBalance,
              interestRate: data.interestRate,
              totalMonths: (data.loanType?.toLowerCase().includes("credit") || data.loanType?.toLowerCase().includes("card")) ? null : data.totalMonths,
              firstPaymentDate: firstPaymentDateValue,
              startDate: startDateValue,
              monthlyPayment: data.monthlyPayment,
              paymentFrequency: data.paymentFrequency,
              paymentAmount: data.paymentAmount,
              principalPaid: data.principalPaid,
              interestPaid: data.interestPaid,
              additionalContributions: data.additionalContributions,
              additionalContributionAmount: data.additionalContributionAmount || 0,
              priority: data.priority || "Medium",
              description: data.description || "",
              accountId: data.accountId,
              isPaused: data.isPaused,
            }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(errorData.error || "Failed to update debt");
        }
      } else {
        // Create new debt
        const res = await fetch("/api/v2/debts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: data.name,
              loanType: data.loanType,
              initialAmount: data.initialAmount,
              downPayment: data.downPayment,
              interestRate: data.interestRate,
              totalMonths: (data.loanType?.toLowerCase().includes("credit") || data.loanType?.toLowerCase().includes("card")) ? null : data.totalMonths,
              firstPaymentDate: firstPaymentDateValue,
              startDate: startDateValue,
              monthlyPayment: data.monthlyPayment,
              paymentFrequency: data.paymentFrequency,
              paymentAmount: data.paymentAmount,
              additionalContributions: data.additionalContributions,
              additionalContributionAmount: data.additionalContributionAmount || 0,
              priority: data.priority || "Medium",
              description: data.description || "",
              accountId: data.accountId,
              isPaused: data.isPaused,
            }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(errorData.error || "Failed to create debt");
        }
      }

      // Optimistic update: call onSuccess immediately
      onOpenChange(false);
      form.reset();
      onSuccess?.();

      toast({
        title: debt ? "Debt updated" : "Debt created",
        description: debt ? "Your debt has been updated successfully." : "Your debt has been created successfully.",
        variant: "success",
      });
    } catch (error) {
      console.error("Error saving debt:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save debt",
        variant: "destructive",
      });
      // Reload on error to revert optimistic update
      onSuccess?.();
    } finally {
      setIsSubmitting(false);
    }
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
          <DialogTitle>{debt ? "Edit" : "Create"} Debt</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit as (data: DebtFormData) => Promise<void>)}
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Loan Information */}
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold mb-1">Loan Information</h3>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    Category
                  </label>
                  <Select
                    value={selectedCategoryId}
                    onValueChange={(value) => {
                      setSelectedCategoryId(value);
                      setSelectedSubcategoryId("");
                      const category = debtsCategories.find((cat) => cat.id === value);
                      if (category) {
                        // Map category name to valid loanType values
                        const mappedLoanType = mapToValidLoanType(category.name);
                        form.setValue("loanType", mappedLoanType);
                      }
                    }}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {debtsCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.loanType && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.loanType.message}
                    </p>
                  )}
                </div>

                {selectedCategoryId && debtsCategories.find(c => c.id === selectedCategoryId)?.subcategories && debtsCategories.find(c => c.id === selectedCategoryId)!.subcategories!.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium">
                      Subcategory (optional)
                    </label>
                    <Select
                      value={selectedSubcategoryId || undefined}
                      onValueChange={(value) => {
                        setSelectedSubcategoryId(value);
                        const subcategory = debtsCategories
                          .find((cat) => cat.id === selectedCategoryId)
                          ?.subcategories?.find((sub) => sub.id === value);
                        if (subcategory) {
                          // Map subcategory name to valid loanType values
                          const mappedLoanType = mapToValidLoanType(subcategory.name);
                          form.setValue("loanType", mappedLoanType);
                        } else {
                          // If subcategory is cleared, use category name mapping
                          const category = debtsCategories.find((cat) => cat.id === selectedCategoryId);
                          if (category) {
                            const mappedLoanType = mapToValidLoanType(category.name);
                            form.setValue("loanType", mappedLoanType);
                          }
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Subcategory (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {debtsCategories
                          .find((cat) => cat.id === selectedCategoryId)
                          ?.subcategories?.map((subcategory) => (
                            <SelectItem key={subcategory.id} value={subcategory.id}>
                              {subcategory.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">
                  Debt Name
                </label>
                <Input
                  {...form.register("name")}
                  required
                />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>
            </div>

            <div className={`grid gap-4 ${fieldConfig.showDownPayment ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  {fieldConfig.initialAmountLabel}
                </label>
                <DollarAmountInput
                  value={form.watch("initialAmount") || undefined}
                  onChange={(value) => form.setValue("initialAmount", value ?? 0, { shouldValidate: true })}
                  placeholder="$ 0.00"
                  required
                />
                {form.formState.errors.initialAmount && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.initialAmount.message}
                  </p>
                )}
              </div>

              {fieldConfig.showDownPayment && (
                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    Down Payment
                  </label>
                  <DollarAmountInput
                    value={form.watch("downPayment") || undefined}
                    onChange={(value) => form.setValue("downPayment", value ?? 0, { shouldValidate: true })}
                    placeholder="$ 0.00"
                    required={fieldConfig.downPaymentRequired}
                  />
                  {form.formState.errors.downPayment && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.downPayment.message}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-sm font-medium">
                  Interest Rate (APR)
                </label>
                <PercentageInput
                  value={form.watch("interestRate") || undefined}
                  onChange={(value) => form.setValue("interestRate", value ?? 0, { shouldValidate: true })}
                  placeholder="0.00 %"
                />
                {form.formState.errors.interestRate && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.interestRate.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Payment Details */}
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold mb-1">Payment Details</h3>
            </div>

            <div className={`grid gap-4 ${fieldConfig.showTotalMonths ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {fieldConfig.showTotalMonths && (
                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    Total Months
                  </label>
                  <Select
                    value={form.watch("totalMonths") ? form.watch("totalMonths")!.toString() : undefined}
                    onValueChange={(value) => {
                      form.setValue("totalMonths", Number(value), { shouldValidate: true });
                    }}
                    required={fieldConfig.totalMonthsRequired}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select months" />
                    </SelectTrigger>
                    <SelectContent>
                      {getTotalMonthsOptions().map((months) => {
                        const years = Math.floor(months / 12);
                        const remainingMonths = months % 12;
                        let label = `${months} months`;
                        if (years > 0 && remainingMonths === 0) {
                          label = `${months} months (${years} ${years === 1 ? 'year' : 'years'})`;
                        } else if (years > 0) {
                          label = `${months} months (${years} ${years === 1 ? 'year' : 'years'}, ${remainingMonths} ${remainingMonths === 1 ? 'month' : 'months'})`;
                        }
                        return (
                          <SelectItem key={months} value={months.toString()}>
                            {label}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.totalMonths && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.totalMonths.message}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-sm font-medium">
                  Payment Frequency
                </label>
                <Select
                  value={form.watch("paymentFrequency")}
                  onValueChange={(value) =>
                    form.setValue("paymentFrequency", value as any)
                  }
                  disabled={fieldConfig.paymentFrequencyLocked}
                  required
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    {!fieldConfig.paymentFrequencyLocked && (
                      <>
                        <SelectItem value="biweekly">Biweekly</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="semimonthly">Semimonthly (Twice a month)</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
                {form.formState.errors.paymentFrequency && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.paymentFrequency.message}
                  </p>
                )}
                {fieldConfig.paymentFrequencyLocked && (
                  <p className="text-xs text-muted-foreground">
                    Credit cards must use monthly payment frequency
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">
                  {fieldConfig.paymentAmountLabel} {((loanType || "").toLowerCase().includes("credit") || (loanType || "").toLowerCase().includes("card")) && <span className="text-gray-400 text-[12px]">optional</span>}
                </label>
                <DollarAmountInput
                  value={form.watch("paymentAmount") || undefined}
                  onChange={(value) => {
                    isPaymentAmountManuallyEdited.current = true;
                    form.setValue("paymentAmount", value ?? 0, { shouldValidate: true });
                  }}
                  placeholder="$ 0.00"
                />
                {form.formState.errors.paymentAmount && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.paymentAmount.message}
                  </p>
                )}
                {paymentAmount && paymentAmount > 0 && paymentFrequency && !fieldConfig.paymentFrequencyLocked && (
                  <p className="text-xs text-muted-foreground">
                    Monthly equivalent: {formatMoney(convertToMonthlyPayment(
                      paymentAmount,
                      paymentFrequency as "monthly" | "biweekly" | "weekly" | "semimonthly" | "daily"
                    ))}
                  </p>
                )}
                {((loanType || "").toLowerCase().includes("credit") || (loanType || "").toLowerCase().includes("card")) && (
                  <p className="text-xs text-muted-foreground">
                    Because this is revolving credit, balances and interest can change monthly.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Account & Dates */}
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold mb-1">Account & Dates</h3>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  Account
                </label>
                <Select
                  value={form.watch("accountId") || ""}
                  onValueChange={(value) => form.setValue("accountId", value)}
                  required
                >
                  <SelectTrigger>
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

              <div className="space-y-1">
                <label className="text-sm font-medium">
                  {fieldConfig.startDateLabel}
                </label>
                <DatePicker
                  date={form.watch("startDate")}
                  onDateChange={(date) => {
                    form.setValue("startDate", date || new Date(), { shouldValidate: true });
                  }}
                  placeholder="Select start date"
                  required={!((loanType || "").toLowerCase().includes("credit") || (loanType || "").toLowerCase().includes("card"))}
                />
                {form.formState.errors.startDate && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.startDate.message}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">
                  {fieldConfig.firstPaymentDateLabel}
                </label>
                <DatePicker
                  date={form.watch("firstPaymentDate")}
                  onDateChange={(date) => {
                    form.setValue("firstPaymentDate", date || new Date(), { shouldValidate: true });
                  }}
                  placeholder="Select first payment date"
                  required
                />
                {form.formState.errors.firstPaymentDate && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.firstPaymentDate.message}
                  </p>
                )}
              </div>
            </div>

            {startDate && totalMonths && totalMonths > 0 && (
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Finish Date (calculated)</label>
                  <Input
                    type="text"
                    value={(() => {
                      try {
                        const start = new Date(startDate);
                        const finish = new Date(start);
                        finish.setMonth(finish.getMonth() + totalMonths);
                        return formatTransactionDate(finish);
                      } catch {
                        return '';
                      }
                    })()}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>
            )}
          </div>

          {debt && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Principal Paid</label>
                <DollarAmountInput
                  value={form.watch("principalPaid") || undefined}
                  onChange={(value) => {
                    isPrincipalPaidManuallyEdited.current = true;
                    form.setValue("principalPaid", value ?? 0, { shouldValidate: true });
                  }}
                  placeholder="$ 0.00"
                />
                {form.formState.errors.principalPaid && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.principalPaid.message}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Interest Paid</label>
                <DollarAmountInput
                  value={form.watch("interestPaid") || undefined}
                  onChange={(value) => form.setValue("interestPaid", value ?? 0, { shouldValidate: true })}
                  placeholder="$ 0.00"
                />
                {form.formState.errors.interestPaid && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.interestPaid.message}
                  </p>
                )}
              </div>
            </div>
          )}

          {forecast && (
            <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
              <h4 className="text-sm font-semibold">Forecast</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Progress</p>
                  <p className="font-semibold">
                    {forecast.progressPct.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Interest Remaining</p>
                  <p className="font-semibold">
                    {formatMoney(forecast.totalInterestRemaining)}
                  </p>
                </div>
              </div>
              {forecast.monthsRemaining !== null && (
                <div className="text-sm">
                  <p className="text-muted-foreground">Months Remaining</p>
                  <p className="font-semibold">
                    {forecast.monthsRemaining === 0
                      ? "Debt paid off!"
                      : forecast.monthsRemaining < 12
                      ? `${Math.round(forecast.monthsRemaining)} month${Math.round(forecast.monthsRemaining) !== 1 ? "s" : ""}`
                      : `${Math.floor(forecast.monthsRemaining / 12)} year${Math.floor(forecast.monthsRemaining / 12) !== 1 ? "s" : ""}, ${Math.round(forecast.monthsRemaining % 12)} month${Math.round(forecast.monthsRemaining % 12) !== 1 ? "s" : ""}`}
                  </p>
                </div>
              )}
            </div>
          )}

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
                  {debt ? "Updating..." : "Creating..."}
                </>
              ) : (
                debt ? "Update" : "Create"
              )} Debt
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
      )}
    </>
  );
}

