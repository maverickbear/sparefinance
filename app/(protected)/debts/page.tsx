"use client";

import { useState, useEffect } from "react";
import { DebtCard } from "@/components/debts/debt-card";
import { DebtForm } from "@/components/forms/debt-form";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, CreditCard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoney } from "@/components/common/money";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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
  isPaidOff: boolean;
  isPaused: boolean;
  paidOffAt?: string | null;
  createdAt: string;
  updatedAt: string;
  monthsRemaining?: number | null;
  totalInterestRemaining?: number;
  progressPct?: number;
}

export default function DebtsPage() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [sortBy, setSortBy] = useState<"priority" | "progress" | "months_remaining">("priority");
  const [filterBy, setFilterBy] = useState<"all" | "active" | "paused" | "paid_off">("all");
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    loadDebts();
  }, []);

  async function loadDebts() {
    try {
      setLoading(true);
      const { getDebtsClient } = await import("@/lib/api/debts-client");
      const data = await getDebtsClient();
      setDebts(data);
      setHasLoaded(true);
    } catch (error) {
      console.error("Error loading debts:", error);
      setHasLoaded(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this debt?")) return;

    try {
      const { deleteDebtClient } = await import("@/lib/api/debts-client");
      await deleteDebtClient(id);

      loadDebts();
    } catch (error) {
      console.error("Error deleting debt:", error);
      alert(error instanceof Error ? error.message : "Failed to delete debt");
    }
  }

  async function handlePause(id: string, isPaused: boolean) {
    try {
      const { updateDebtClient } = await import("@/lib/api/debts-client");
      await updateDebtClient(id, { isPaused: !isPaused });

      loadDebts();
    } catch (error) {
      console.error("Error pausing/resuming debt:", error);
      alert(error instanceof Error ? error.message : "Failed to update debt");
    }
  }

  async function handlePayment(id: string) {
    setSelectedDebt(debts.find((d) => d.id === id) || null);
    setIsPaymentOpen(true);
  }

  async function submitPayment() {
    if (!selectedDebt) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    try {
      const { addPaymentClient } = await import("@/lib/api/debts-client");
      await addPaymentClient(selectedDebt.id, amount);

      setIsPaymentOpen(false);
      setPaymentAmount("");
      setSelectedDebt(null);
      loadDebts();
    } catch (error) {
      console.error("Error adding payment:", error);
      alert(error instanceof Error ? error.message : "Failed to add payment");
    }
  }

  // Filter and sort debts
  const filteredDebts = debts.filter((debt) => {
    if (filterBy === "active") return !debt.isPaidOff && !debt.isPaused;
    if (filterBy === "paused") return debt.isPaused;
    if (filterBy === "paid_off") return debt.isPaidOff;
    return true;
  });

  const sortedDebts = [...filteredDebts].sort((a, b) => {
    if (sortBy === "priority") {
      const priorityOrder = { High: 3, Medium: 2, Low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    }
    if (sortBy === "progress") {
      return (b.progressPct || 0) - (a.progressPct || 0);
    }
    if (sortBy === "months_remaining") {
      const aMonths = a.monthsRemaining ?? Infinity;
      const bMonths = b.monthsRemaining ?? Infinity;
      return aMonths - bMonths;
    }
    return 0;
  });

  // Show empty state when no debts and has loaded (or not loading on first render)
  if ((hasLoaded || !loading) && filterBy === "all" && debts.length === 0) {
    return (
      <div>
        <EmptyState
          image={<CreditCard className="w-full h-full text-muted-foreground opacity-50" />}
          title="No debts found"
          description="Start tracking your loans and debt payments by creating your first debt entry."
          action={{
            label: "Create Debt",
            onClick: () => {
              setSelectedDebt(null);
              setIsFormOpen(true);
            },
          }}
        />
        <DebtForm
          debt={selectedDebt || undefined}
          open={isFormOpen}
          onOpenChange={(open) => {
            setIsFormOpen(open);
            if (!open) {
              setSelectedDebt(null);
            }
          }}
          onSuccess={() => {
            loadDebts();
            setSelectedDebt(null);
          }}
        />
        <Dialog 
          open={isPaymentOpen} 
          onOpenChange={(open) => {
            setIsPaymentOpen(open);
            if (!open) {
              setPaymentAmount("");
              setSelectedDebt(null);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
              <DialogDescription>
                Record a payment for {selectedDebt?.name || "this debt"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Payment Amount</label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={paymentAmount || ""}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
                {selectedDebt && (
                  <p className="text-xs text-muted-foreground">
                    Current balance: {formatMoney(selectedDebt.currentBalance)}
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsPaymentOpen(false);
                  setPaymentAmount("");
                  setSelectedDebt(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={submitPayment}>Record Payment</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Debts</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Track your loans and debt payments
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setSelectedDebt(null);
            setIsFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Debt
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Filter:</label>
            <Select value={filterBy} onValueChange={(value) => setFilterBy(value as typeof filterBy)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Debts</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="paid_off">Paid Off</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Sort:</label>
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="progress">Progress</SelectItem>
                <SelectItem value="months_remaining">Months Remaining</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {loading && debts.length > 0 ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center gap-6">
                  <Skeleton className="h-20 w-20 rounded-full flex-shrink-0" />
                  <div className="flex-1 min-w-0 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                      <Skeleton className="h-8 w-8 rounded" />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[1, 2, 3, 4].map((j) => (
                        <div key={j} className="space-y-1">
                          <Skeleton className="h-3 w-20" />
                          <Skeleton className="h-5 w-24" />
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                      {[1, 2, 3, 4].map((j) => (
                        <div key={j} className="space-y-1">
                          <Skeleton className="h-3 w-16" />
                          <Skeleton className="h-4 w-20" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {sortedDebts.map((debt) => (
            <DebtCard
              key={debt.id}
              debt={debt}
              onEdit={(d) => {
                setSelectedDebt({ ...d, createdAt: debt.createdAt, updatedAt: debt.updatedAt });
                setIsFormOpen(true);
              }}
              onDelete={handleDelete}
              onPause={handlePause}
              onPayment={handlePayment}
            />
          ))}

          {sortedDebts.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              {filterBy === "all"
                ? "No debts created yet. Create one to get started."
                : `No ${filterBy} debts found.`}
            </div>
          )}
        </div>
      )}

      <DebtForm
        debt={selectedDebt || undefined}
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) {
            setSelectedDebt(null);
          }
        }}
        onSuccess={() => {
          loadDebts();
          setSelectedDebt(null);
        }}
      />

      <Dialog 
        open={isPaymentOpen} 
        onOpenChange={(open) => {
          setIsPaymentOpen(open);
          if (!open) {
            setPaymentAmount("");
            setSelectedDebt(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record a payment for {selectedDebt?.name || "this debt"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Payment Amount</label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={paymentAmount || ""}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
              {selectedDebt && (
                <p className="text-xs text-muted-foreground">
                  Current balance: {formatMoney(selectedDebt.currentBalance)}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsPaymentOpen(false);
                setPaymentAmount("");
                setSelectedDebt(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={submitPayment}>Record Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

