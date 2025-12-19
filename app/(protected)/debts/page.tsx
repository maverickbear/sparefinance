"use client";

import { useState, useEffect } from "react";
import { usePagePerformance } from "@/hooks/use-page-performance";
import { DebtCard } from "@/components/debts/debt-card";
import { DebtForm } from "@/components/forms/debt-form";
import { Button } from "@/components/ui/button";
import { Plus, CreditCard, Loader2 } from "lucide-react";
import { RecordPaymentDialog } from "@/components/debts/record-payment-dialog";
import { useToast } from "@/components/toast-provider";
import { formatMoney } from "@/components/common/money";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { PageHeader } from "@/components/common/page-header";
import { useWriteGuard } from "@/hooks/use-write-guard";
import { FeatureGuard } from "@/components/common/feature-guard";

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
  isPaidOff: boolean;
  isPaused: boolean;
  paidOffAt?: string | null;
  createdAt: string;
  updatedAt: string;
  status?: string;
  nextDueDate?: string | null;
  monthsRemaining?: number | null;
  totalInterestRemaining?: number;
  progressPct?: number;
}

export default function DebtsPage() {
  const perf = usePagePerformance("Debts");
  const { openDialog, ConfirmDialog } = useConfirmDialog();
  const { checkWriteAccess, canWrite } = useWriteGuard();
  const { toast } = useToast();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [sortBy, setSortBy] = useState<"priority" | "progress" | "months_remaining">("priority");
  const [filterBy, setFilterBy] = useState<"all" | "active" | "paused" | "paid_off">("all");
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pausingId, setPausingId] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);

  useEffect(() => {
    loadDebts();
  }, []);

  async function loadDebts() {
    try {
      setLoading(true);
      const response = await fetch("/api/v2/debts");
      if (!response.ok) {
        throw new Error("Failed to fetch debts");
      }
      const data = await response.json();
      setDebts(data);
      setHasLoaded(true);
      perf.markDataLoaded();
    } catch (error) {
      console.error("Error loading debts:", error);
      setHasLoaded(true);
      perf.markDataLoaded();
    } finally {
      setLoading(false);
    }
  }

  function handleDelete(id: string) {
    openDialog(
      {
        title: "Delete Debt",
        description: "Are you sure you want to delete this debt?",
        variant: "destructive",
        confirmLabel: "Delete",
      },
      async () => {
        setDeletingId(id);
        try {
          const response = await fetch(`/api/v2/debts/${id}`, {
            method: "DELETE",
          });
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Failed to delete debt");
          }

          loadDebts();
        } catch (error) {
          console.error("Error deleting debt:", error);
          alert(error instanceof Error ? error.message : "Failed to delete debt");
        } finally {
          setDeletingId(null);
        }
      }
    );
  }

  async function handlePause(id: string, isPaused: boolean) {
    setPausingId(id);
    try {
      const response = await fetch(`/api/v2/debts/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isPaused: !isPaused }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update debt");
      }

      loadDebts();
    } catch (error) {
      console.error("Error pausing/resuming debt:", error);
      alert(error instanceof Error ? error.message : "Failed to update debt");
    } finally {
      setPausingId(null);
    }
  }

  async function handlePayment(id: string) {
    setSelectedDebt(debts.find((d) => d.id === id) || null);
    setIsPaymentOpen(true);
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


  return (
    <FeatureGuard 
      feature="hasDebts"
      headerTitle="Debts"
    >
      <PageHeader
        title="Debts"
      />

      <div className="w-full p-4 lg:p-8">
        {/* Action Buttons - Moved from header */}
        {!(sortedDebts.length === 0 && filterBy === "all") && canWrite && (
          <div className="flex items-center gap-2 justify-end mb-6">
            <Button
              size="medium"
              onClick={() => {
                if (!checkWriteAccess()) return;
                setSelectedDebt(null);
                setIsFormOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Debt
            </Button>
          </div>
        )}

      {loading && debts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1">
                      <Skeleton className="h-[60px] w-[60px] rounded-full flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                    <Skeleton className="h-8 w-8 rounded" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[1, 2, 3, 4].map((j) => (
                      <div key={j} className="space-y-1">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                    {[1, 2].map((j) => (
                      <div key={j} className="space-y-1">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {sortedDebts.map((debt) => (
            <DebtCard
              key={debt.id}
              debt={debt}
              onEdit={(d) => {
                if (!checkWriteAccess()) return;
                setSelectedDebt({ ...d, createdAt: debt.createdAt, updatedAt: debt.updatedAt });
                setIsFormOpen(true);
              }}
              onDelete={(id) => {
                if (!checkWriteAccess()) return;
                if (deletingId !== id) {
                  handleDelete(id);
                }
              }}
              onPause={(id, isPaused) => {
                if (pausingId !== id) {
                  handlePause(id, isPaused);
                }
              }}
              onPayment={handlePayment}
            />
          ))}

          {sortedDebts.length === 0 && (
            <div className="col-span-full w-full h-full min-h-[400px]">
              <EmptyState
                icon={CreditCard}
                title={filterBy === "all" ? "No debts created yet" : `No ${filterBy} debts found`}
                description={
                  filterBy === "all"
                    ? "Create your first debt entry to start tracking your loans and debt payments."
                    : `Try adjusting your filters to see ${filterBy === "active" ? "completed" : "active"} debts.`
                }
              />
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

      <RecordPaymentDialog
        open={isPaymentOpen}
        onOpenChange={(open) => {
          setIsPaymentOpen(open);
          if (!open) {
            setSelectedDebt(null);
          }
        }}
        debt={selectedDebt}
        onConfirm={async (amount) => {
          if (!selectedDebt) return;
          setPaymentLoading(true);
          try {
            const response = await fetch(`/api/v2/debts/${selectedDebt.id}/payment`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ amount }),
            });
            if (!response.ok) {
              const error = await response.json();
              throw new Error(error.error || "Failed to add payment");
            }

            setIsPaymentOpen(false);
            setSelectedDebt(null);
            loadDebts();
          } catch (error) {
            console.error("Error adding payment:", error);
            toast({
              title: "Error",
              description: error instanceof Error ? error.message : "Failed to add payment",
              variant: "destructive",
            });
          } finally {
            setPaymentLoading(false);
          }
        }}
        loading={paymentLoading}
      />
      {ConfirmDialog}
      </div>

      {/* Mobile Floating Action Button */}
      {canWrite && (
        <div className="fixed bottom-20 right-4 z-[60] lg:hidden">
          <Button
            size="medium"
            className="h-14 w-14 rounded-full shadow-lg"
            onClick={() => {
              if (!checkWriteAccess()) return;
              setSelectedDebt(null);
              setIsFormOpen(true);
            }}
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>
      )}
    </FeatureGuard>
  );
}

