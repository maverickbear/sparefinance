"use client";

import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { debtSchema, DebtFormData } from "@/lib/validations/debt";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoney } from "@/components/common/money";
import { calculateDebtMetrics, convertToMonthlyPayment, type DebtForCalculation } from "@/lib/utils/debts";
import { useToast } from "@/components/toast-provider";

interface Debt {
  id: string;
  name: string;
  loanType: string;
  initialAmount: number;
  downPayment: number;
  currentBalance: number;
  interestRate: number;
  totalMonths: number;
  firstPaymentDate: string;
  monthlyPayment: number;
  principalPaid: number;
  interestPaid: number;
  additionalContributions: boolean;
  additionalContributionAmount?: number | null;
  priority: "High" | "Medium" | "Low";
  description?: string | null;
  accountId?: string | null;
  isPaused: boolean;
  isPaidOff: boolean;
}

interface DebtFormProps {
  debt?: Debt;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function DebtForm({
  debt,
  open,
  onOpenChange,
  onSuccess,
}: DebtFormProps) {
  const { toast } = useToast();
  const [forecast, setForecast] = useState<{
    monthsRemaining: number | null;
    totalInterestRemaining: number;
    progressPct: number;
  } | null>(null);
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string; type: string }>>([]);
  
  const isInitialLoad = useRef(false);
  const isDataLoaded = useRef(false);

  const form = useForm<DebtFormData>({
    resolver: zodResolver(debtSchema),
    defaultValues: {
      name: "",
      loanType: "other",
      initialAmount: 0,
      downPayment: 0,
      currentBalance: 0,
      interestRate: 0,
      totalMonths: 0,
      firstPaymentDate: new Date(),
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
      if (Math.abs(calculatedMonthly - currentMonthly) > 0.01) {
        form.setValue("monthlyPayment", calculatedMonthly, { shouldValidate: false });
      }
    }
  }, [paymentAmount, paymentFrequency, form, open]);

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

  // Load accounts
  useEffect(() => {
    if (open) {
      loadAccounts();
    }
  }, [open]);

  async function loadAccounts() {
    try {
      const res = await fetch("/api/accounts");
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

      form.reset({
        name: debt.name ?? "",
        loanType: (debt.loanType ?? "other") as "other" | "car_loan" | "mortgage" | "personal_loan" | "credit_card" | "student_loan" | "business_loan",
        initialAmount: debt.initialAmount ?? 0,
        downPayment: debt.downPayment ?? 0,
        currentBalance: debt.currentBalance ?? 0,
        interestRate: debt.interestRate ?? 0,
        totalMonths: debt.totalMonths ?? 0,
        firstPaymentDate: firstPaymentDateValue,
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
        loanType: "other",
        initialAmount: 0,
        downPayment: 0,
        currentBalance: 0,
        interestRate: 0,
        totalMonths: 0,
        firstPaymentDate: new Date(),
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
      
      // Mark data as loaded for new debt too
      setTimeout(() => {
        isDataLoaded.current = true;
      }, 100);
    }
  }, [open, debt?.id, form]);

  async function onSubmit(data: DebtFormData) {
    try {
      // Calculate initial balance
      const calculatedBalance = data.currentBalance > 0
        ? data.currentBalance
        : data.initialAmount - data.downPayment - data.principalPaid;

      // Convert firstPaymentDate to ISO string for API
      const firstPaymentDateValue = data.firstPaymentDate instanceof Date
        ? data.firstPaymentDate.toISOString()
        : data.firstPaymentDate;

      if (debt) {
        // Update existing debt
        const res = await fetch(`/api/debts/${debt.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: data.name,
              loanType: data.loanType,
              initialAmount: data.initialAmount,
              downPayment: data.downPayment,
              currentBalance: calculatedBalance,
              interestRate: data.interestRate,
              totalMonths: data.totalMonths,
              firstPaymentDate: firstPaymentDateValue,
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
        const res = await fetch("/api/debts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: data.name,
            loanType: data.loanType,
            initialAmount: data.initialAmount,
            downPayment: data.downPayment,
            interestRate: data.interestRate,
            totalMonths: data.totalMonths,
            firstPaymentDate: firstPaymentDateValue,
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
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{debt ? "Edit" : "Create"} Debt</DialogTitle>
          <DialogDescription>
            {debt
              ? "Update your debt details"
              : "Create a new debt and track your payment progress"}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <div className="space-y-1">
            <label className="text-sm font-medium">Debt Name *</label>
            <Input
              {...form.register("name")}
              placeholder="e.g., Car Loan, Mortgage"
            />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Loan Type *</label>
            <Select
              value={form.watch("loanType")}
              onValueChange={(value) =>
                form.setValue("loanType", value as any)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mortgage">Mortgage</SelectItem>
                <SelectItem value="car_loan">Car Loan</SelectItem>
                <SelectItem value="personal_loan">Personal Loan</SelectItem>
                <SelectItem value="credit_card">Credit Card</SelectItem>
                <SelectItem value="student_loan">Student Loan</SelectItem>
                <SelectItem value="business_loan">Business Loan</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            {form.formState.errors.loanType && (
              <p className="text-xs text-destructive">
                {form.formState.errors.loanType.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Account *</label>
            <Select
              value={form.watch("accountId") || ""}
              onValueChange={(value) => form.setValue("accountId", value || undefined)}
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
            {form.formState.errors.accountId && (
              <p className="text-xs text-destructive">
                {form.formState.errors.accountId.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Initial Amount *</label>
              <Input
                type="number"
                step="0.01"
                {...form.register("initialAmount", { valueAsNumber: true })}
                placeholder="0.00"
              />
              {form.formState.errors.initialAmount && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.initialAmount.message}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Down Payment *</label>
              <Input
                type="number"
                step="0.01"
                {...form.register("downPayment", { valueAsNumber: true })}
                placeholder="0.00"
              />
              {form.formState.errors.downPayment && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.downPayment.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Interest Rate (%) *</label>
              <Input
                type="number"
                step="0.01"
                {...form.register("interestRate", { valueAsNumber: true })}
                placeholder="12.5"
              />
              {form.formState.errors.interestRate && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.interestRate.message}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Total Months *</label>
              <Input
                type="number"
                {...form.register("totalMonths", { valueAsNumber: true })}
                placeholder="60"
              />
              {form.formState.errors.totalMonths && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.totalMonths.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Payment Frequency *</label>
              <Select
                value={form.watch("paymentFrequency")}
                onValueChange={(value) =>
                  form.setValue("paymentFrequency", value as any)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="biweekly">Biweekly</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="semimonthly">Semimonthly (Twice a month)</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.paymentFrequency && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.paymentFrequency.message}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Payment Amount *</label>
              <Input
                type="number"
                step="0.01"
                {...form.register("paymentAmount", { valueAsNumber: true })}
                placeholder="0.00"
              />
              {form.formState.errors.paymentAmount && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.paymentAmount.message}
                </p>
              )}
              {paymentAmount && paymentAmount > 0 && paymentFrequency && (
                <p className="text-xs text-muted-foreground">
                  Monthly equivalent: {formatMoney(convertToMonthlyPayment(
                    paymentAmount,
                    paymentFrequency as "monthly" | "biweekly" | "weekly" | "semimonthly" | "daily"
                  ))}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">First Payment Date *</label>
            <Input
              type="date"
              value={
                form.watch("firstPaymentDate")
                  ? new Date(form.watch("firstPaymentDate")).toISOString().split("T")[0]
                  : ""
              }
              onChange={(e) => {
                const date = e.target.value ? new Date(e.target.value) : new Date();
                form.setValue("firstPaymentDate", date, { shouldValidate: true });
              }}
            />
            {form.formState.errors.firstPaymentDate && (
              <p className="text-xs text-destructive">
                {form.formState.errors.firstPaymentDate.message}
              </p>
            )}
          </div>

          {debt && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Principal Paid</label>
                <Input
                  type="number"
                  step="0.01"
                  {...form.register("principalPaid", { valueAsNumber: true })}
                  placeholder="0.00"
                />
                {form.formState.errors.principalPaid && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.principalPaid.message}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Interest Paid</label>
                <Input
                  type="number"
                  step="0.01"
                  {...form.register("interestPaid", { valueAsNumber: true })}
                  placeholder="0.00"
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
            <div className="rounded-[12px] border bg-muted/50 p-4 space-y-3">
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

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">
              {debt ? "Update" : "Create"} Debt
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

