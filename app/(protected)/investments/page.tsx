"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/components/common/money";
import { Plus, Edit, Loader2 } from "lucide-react";
import { FeatureGuard } from "@/components/common/feature-guard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { DollarAmountInput } from "@/components/common/dollar-amount-input";

interface InvestmentAccount {
  id: string;
  name: string;
  type: string;
  balance: number;
  totalValue?: number;
}

interface InvestmentEntry {
  id: string;
  accountId: string;
  date: string;
  type: "contribution" | "dividend" | "interest" | "initial";
  amount: number;
  description?: string;
}

const investmentEntrySchema = z.object({
  accountId: z.string().min(1, "Account is required"),
  date: z.date(),
  type: z.enum(["contribution", "dividend", "interest", "initial"]),
  amount: z.number().positive("Amount must be positive"),
  description: z.string().optional(),
});

type InvestmentEntryFormData = z.infer<typeof investmentEntrySchema>;

const accountValueSchema = z.object({
  accountId: z.string().min(1, "Account is required"),
  totalValue: z.number().positive("Value must be positive"),
});

type AccountValueFormData = z.infer<typeof accountValueSchema>;

export default function InvestmentsPage() {
  const [accounts, setAccounts] = useState<InvestmentAccount[]>([]);
  const [entries, setEntries] = useState<InvestmentEntry[]>([]);
  const [openEntryDialog, setOpenEntryDialog] = useState(false);
  const [openValueDialog, setOpenValueDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<InvestmentAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isSubmittingEntry, setIsSubmittingEntry] = useState(false);
  const [isSubmittingValue, setIsSubmittingValue] = useState(false);

  const entryForm = useForm<InvestmentEntryFormData>({
    resolver: zodResolver(investmentEntrySchema),
    defaultValues: {
      date: new Date(),
      type: "contribution",
      amount: 0,
    },
  });

  const valueForm = useForm<AccountValueFormData>({
    resolver: zodResolver(accountValueSchema),
    defaultValues: {
      totalValue: 0,
    },
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const { getAccountsClient } = await import("@/lib/api/accounts-client");
      const [accountsData, entriesRes] = await Promise.all([
        getAccountsClient(),
        fetch("/api/investments/entries").then((r) => r.json()).catch(() => []),
      ]);
      const entriesData = entriesRes;

      // Filter only investment accounts
      const investmentAccounts = accountsData.filter(
        (acc: InvestmentAccount) => acc.type === "investment"
      );

      // Fetch account values
      const valuesPromises = investmentAccounts.map((acc: InvestmentAccount) =>
        fetch(`/api/investments/accounts/${acc.id}/value`)
          .then((r) => r.json())
          .catch(() => null)
      );
      const valuesData = await Promise.all(valuesPromises);

      // Calculate total value for each account
      const accountsWithValues = investmentAccounts.map((acc: InvestmentAccount, index: number) => {
        const accountValue = valuesData[index];
        const accountEntries = entriesData.filter(
          (entry: InvestmentEntry) => entry.accountId === acc.id
        );

        // If there's a stored value, use it; otherwise calculate from entries
        let totalValue = accountValue?.totalValue;
        if (totalValue === null || totalValue === undefined) {
          totalValue = accountEntries.reduce((sum: number, entry: InvestmentEntry) => {
            // All entry types contribute to the total value
            if (entry.type === "initial" || entry.type === "contribution") {
              return sum + entry.amount;
            } else if (entry.type === "dividend" || entry.type === "interest") {
              return sum + entry.amount;
            }
            return sum;
          }, acc.balance || 0);
        }
        return { ...acc, totalValue };
      });

      setAccounts(accountsWithValues);
      setEntries(entriesData);
      setHasLoaded(true);
    } catch (error) {
      console.error("Error loading data:", error);
      setHasLoaded(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitEntry(data: InvestmentEntryFormData) {
    try {
      setIsSubmittingEntry(true);
      const response = await fetch("/api/investments/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save entry");
      }

      await loadData();
      setOpenEntryDialog(false);
      entryForm.reset();
    } catch (error) {
      console.error("Error saving entry:", error);
      const message = error instanceof Error ? error.message : "Failed to save entry";
      alert(message);
    } finally {
      setIsSubmittingEntry(false);
    }
  }

  async function handleSubmitValue(data: AccountValueFormData) {
    try {
      setIsSubmittingValue(true);
      const response = await fetch(`/api/investments/accounts/${data.accountId}/value`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totalValue: data.totalValue }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update value");
      }

      await loadData();
      setOpenValueDialog(false);
      valueForm.reset();
      setEditingAccount(null);
    } catch (error) {
      console.error("Error updating value:", error);
      const message = error instanceof Error ? error.message : "Failed to update value";
      alert(message);
    } finally {
      setIsSubmittingValue(false);
    }
  }

  function handleEditValue(account: InvestmentAccount) {
    setEditingAccount(account);
    valueForm.reset({
      accountId: account.id,
      totalValue: account.totalValue || account.balance || 0,
    });
    setOpenValueDialog(true);
  }

  function getAccountEntries(accountId: string) {
    return entries.filter((entry) => entry.accountId === accountId);
  }

  function getMonthlyContributions(accountId: string) {
    const accountEntries = getAccountEntries(accountId).filter(
      (entry) => entry.type === "contribution"
    );
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    return accountEntries
      .filter((entry) => new Date(entry.date) >= thisMonth)
      .reduce((sum, entry) => sum + entry.amount, 0);
  }

  function getTotalDividends(accountId: string) {
    const accountEntries = getAccountEntries(accountId);
    return accountEntries
      .filter((entry) => entry.type === "dividend" || entry.type === "interest")
      .reduce((sum, entry) => sum + entry.amount, 0);
  }

  function getInitialBalance(accountId: string) {
    const accountEntries = getAccountEntries(accountId);
    const initialEntry = accountEntries.find((entry) => entry.type === "initial");
    return initialEntry ? initialEntry.amount : 0;
  }

  return (
    <FeatureGuard feature="hasInvestments" featureName="Investments">
      <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Investments</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Manage your investments by account
          </p>
        </div>
        <Button onClick={() => setOpenEntryDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Entry
        </Button>
      </div>

      {accounts.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => {
            const monthlyContributions = getMonthlyContributions(account.id);
            const totalDividends = getTotalDividends(account.id);
            const initialBalance = getInitialBalance(account.id);
            const accountEntries = getAccountEntries(account.id);

            return (
              <Card key={account.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{account.name}</CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditValue(account)}
                      className="h-8 w-8"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Total Value</div>
                    <div className="text-2xl font-bold">{formatMoney(account.totalValue || 0)}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">This Month</div>
                      <div className="font-medium">{formatMoney(monthlyContributions)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Dividends/Juros</div>
                      <div className="font-medium text-green-600 dark:text-green-400">
                        {formatMoney(totalDividends)}
                      </div>
                    </div>
                    {initialBalance > 0 && (
                      <div className="col-span-2">
                        <div className="text-xs text-muted-foreground mb-1">Initial Balance</div>
                        <div className="font-medium">{formatMoney(initialBalance)}</div>
                      </div>
                    )}
                  </div>

                  {accountEntries.length > 0 && (
                    <div className="pt-4 border-t">
                      <div className="text-xs text-muted-foreground mb-2">Recent Entries</div>
                      <div className="space-y-1">
                        {accountEntries
                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .slice(0, 3)
                          .map((entry) => (
                            <div key={entry.id} className="flex justify-between text-xs">
                              <span>
                                {format(new Date(entry.date), "MMM dd")} -{" "}
                                {entry.type === "initial"
                                  ? "Saldo Inicial"
                                  : entry.type === "contribution"
                                  ? "Aporte"
                                  : entry.type === "dividend"
                                  ? "Dividendo"
                                  : "Juros"}
                              </span>
                              <span className="font-medium">{formatMoney(entry.amount)}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Entry Dialog */}
      <Dialog
        open={openEntryDialog}
        onOpenChange={(isOpen) => {
          setOpenEntryDialog(isOpen);
          if (!isOpen) {
            entryForm.reset();
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Investment Entry</DialogTitle>
            <DialogDescription>
              Add a monthly contribution, dividend, or interest payment
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={entryForm.handleSubmit(handleSubmitEntry)} className="space-y-4 p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Account</label>
                <select
                  {...entryForm.register("accountId")}
                  className="flex h-10 w-full rounded-[12px] border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Select account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
                {entryForm.formState.errors.accountId && (
                  <p className="text-xs text-destructive mt-1">
                    {entryForm.formState.errors.accountId.message}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Date</label>
                <Input
                  type="date"
                  {...entryForm.register("date", {
                    valueAsDate: true,
                  })}
                  value={
                    entryForm.watch("date")
                      ? format(entryForm.watch("date") as Date, "yyyy-MM-dd")
                      : ""
                  }
                  onChange={(e) => {
                    const newDate = new Date(e.target.value);
                    if (!isNaN(newDate.getTime())) {
                      entryForm.setValue("date", newDate);
                    }
                  }}
                />
                {entryForm.formState.errors.date && (
                  <p className="text-xs text-destructive mt-1">
                    {entryForm.formState.errors.date.message}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Type</label>
                <select
                  {...entryForm.register("type")}
                  className="flex h-10 w-full rounded-[12px] border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="initial">Initial Balance</option>
                  <option value="contribution">Monthly Contribution</option>
                  <option value="dividend">Dividend</option>
                  <option value="interest">Interest</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Amount</label>
                <DollarAmountInput
                  value={entryForm.watch("amount") || undefined}
                  onChange={(value) => entryForm.setValue("amount", value ?? 0, { shouldValidate: true })}
                  placeholder="$ 0.00"
                />
                {entryForm.formState.errors.amount && (
                  <p className="text-xs text-destructive mt-1">
                    {entryForm.formState.errors.amount.message}
                  </p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-medium mb-2 block">Description (optional)</label>
                <Input {...entryForm.register("description")} />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpenEntryDialog(false);
                  entryForm.reset();
                }}
                disabled={isSubmittingEntry}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmittingEntry}>
                {isSubmittingEntry ? (
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

      {/* Edit Value Dialog */}
      <Dialog
        open={openValueDialog}
        onOpenChange={(isOpen) => {
          setOpenValueDialog(isOpen);
          if (!isOpen) {
            valueForm.reset();
            setEditingAccount(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Total Value</DialogTitle>
            <DialogDescription>
              Update the total investment value for {editingAccount?.name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={valueForm.handleSubmit(handleSubmitValue)} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Total Value</label>
              <DollarAmountInput
                value={valueForm.watch("totalValue") || undefined}
                onChange={(value) => valueForm.setValue("totalValue", value ?? 0, { shouldValidate: true })}
                placeholder="$ 0.00"
              />
              {valueForm.formState.errors.totalValue && (
                <p className="text-xs text-destructive mt-1">
                  {valueForm.formState.errors.totalValue.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpenValueDialog(false);
                  valueForm.reset();
                  setEditingAccount(null);
                }}
                disabled={isSubmittingValue}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmittingValue}>
                {isSubmittingValue ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      </div>
    </FeatureGuard>
  );
}
