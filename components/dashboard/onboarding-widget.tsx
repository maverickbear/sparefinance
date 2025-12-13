"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AccountForm } from "@/components/forms/account-form";
import { 
  Wallet, 
  User,
  CheckCircle2, 
  X,
  ArrowRight,
  Sparkles,
  DollarSign,
  ChevronRight,
  Pencil
} from "lucide-react";
import { cn } from "@/lib/utils";
// Using API routes instead of client-side APIs
import { formatMoney } from "@/components/common/money";
import { ProfileModal } from "@/components/profile/profile-modal";
import { IncomeOnboardingDialog } from "@/src/presentation/components/features/onboarding/income-onboarding-dialog";
import { ExpectedIncomeRange } from "@/src/domain/onboarding/onboarding.types";

// Income range labels mapping
const INCOME_RANGE_LABELS: Record<NonNullable<ExpectedIncomeRange>, string> = {
  "0-50k": "$0 - $50,000",
  "50k-100k": "$50,000 - $100,000",
  "100k-150k": "$100,000 - $150,000",
  "150k-250k": "$150,000 - $250,000",
  "250k+": "$250,000+",
};

function formatIncomeRange(incomeRange: ExpectedIncomeRange): string {
  if (!incomeRange) return "";
  return INCOME_RANGE_LABELS[incomeRange] || incomeRange;
}

interface OnboardingStatus {
  hasAccount: boolean;
  hasCompleteProfile: boolean;
  hasExpectedIncome: boolean;
  completedCount: number;
  totalCount: number;
  totalBalance?: number;
  expectedIncome?: ExpectedIncomeRange;
}

interface OnboardingWidgetProps {
  initialStatus?: OnboardingStatus;
}

export function OnboardingWidget({ initialStatus }: OnboardingWidgetProps) {
  const router = useRouter();
  const [status, setStatus] = useState<OnboardingStatus | null>(initialStatus || null);
  const [isAccountFormOpen, setIsAccountFormOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isIncomeDialogOpen, setIsIncomeDialogOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [loading, setLoading] = useState(!initialStatus);

  useEffect(() => {
    // Load initial status if not provided
    if (!initialStatus) {
      checkStatus();
    } else {
      // If we have initial status, check if widget should be shown
      // Only respect dismissal if onboarding is actually complete
      const dismissed = localStorage.getItem("onboarding-widget-dismissed");
      if (dismissed === "true" && initialStatus.completedCount === initialStatus.totalCount) {
        setIsDismissed(true);
        return;
      }
      // If dismissed but not complete, reset dismissal to show widget again
      if (dismissed === "true" && initialStatus.completedCount < initialStatus.totalCount) {
        localStorage.removeItem("onboarding-widget-dismissed");
      }
    }
  }, [initialStatus]);

  // Check status when page becomes visible again (e.g., user returns from accounts page)
  useEffect(() => {
    let visibilityTimeoutId: NodeJS.Timeout | null = null;
    let focusTimeoutId: NodeJS.Timeout | null = null;
    let accountCreatedTimeoutId: NodeJS.Timeout | null = null;

    const handleVisibilityChange = () => {
      // Only check if page is visible and we have a status (to avoid unnecessary checks)
      if (document.visibilityState === "visible" && status) {
        // Clear any pending timeout
        if (visibilityTimeoutId) {
          clearTimeout(visibilityTimeoutId);
        }
        // Debounce to avoid too many checks
        visibilityTimeoutId = setTimeout(() => {
          checkStatus();
        }, 500);
      }
    };

    // Also check when window gains focus (user switches back to tab)
    const handleFocus = () => {
      if (status) {
        // Clear any pending timeout
        if (focusTimeoutId) {
          clearTimeout(focusTimeoutId);
        }
        focusTimeoutId = setTimeout(() => {
          checkStatus();
        }, 500);
      }
    };

    // Listen for account creation events (from other pages/components)
    const handleAccountCreated = () => {
      // Clear any pending timeout
      if (accountCreatedTimeoutId) {
        clearTimeout(accountCreatedTimeoutId);
      }
      // Wait a bit for the account to be fully created
      accountCreatedTimeoutId = setTimeout(() => {
        checkStatus();
      }, 1000);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("account-created", handleAccountCreated);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("account-created", handleAccountCreated);
      if (visibilityTimeoutId) {
        clearTimeout(visibilityTimeoutId);
      }
      if (focusTimeoutId) {
        clearTimeout(focusTimeoutId);
      }
      if (accountCreatedTimeoutId) {
        clearTimeout(accountCreatedTimeoutId);
      }
    };
  }, [status]);


  async function checkStatus() {
    try {
      setLoading(true);
      const [accountsResponse, profileResponse, incomeResponse] = await Promise.all([
        fetch("/api/v2/accounts?includeHoldings=false"),
        fetch("/api/v2/profile"),
        fetch("/api/v2/onboarding/income").catch(() => ({ ok: false })), // Don't fail if income check fails
      ]);
      
      if (!accountsResponse.ok || !profileResponse.ok) {
        throw new Error("Failed to fetch data");
      }
      
      const [accounts, profile, incomeData] = await Promise.all([
        accountsResponse.json(),
        profileResponse.json(),
        incomeResponse.ok && 'json' in incomeResponse ? incomeResponse.json() : Promise.resolve({ hasExpectedIncome: false }),
      ]);

      const hasAccount = accounts.length > 0;
      // Calculate total balance from accounts
      // The balance should already include initialBalance from the API response,
      // but we'll use initialBalance as fallback if balance is missing
      const totalBalance = hasAccount 
        ? accounts.reduce((sum: number, acc: any) => {
            // Use balance if available, otherwise fall back to initialBalance
            let accountBalance = 0;
            if (acc.balance !== undefined && acc.balance !== null) {
              accountBalance = acc.balance;
            } else if ((acc as any).initialBalance !== undefined && (acc as any).initialBalance !== null) {
              accountBalance = (acc as any).initialBalance;
            }
            // Debug log to help identify issues
            if (hasAccount && accounts.length === 1) {
              console.log("[OnboardingWidget] Account balance calculation:", {
                accountId: acc.id,
                accountName: acc.name,
                balance: acc.balance,
                initialBalance: (acc as any).initialBalance,
                calculatedBalance: accountBalance,
              });
            }
            return sum + accountBalance;
          }, 0)
        : undefined;
      
      const hasCompleteProfile = profile !== null && profile.name !== null && profile.name.trim() !== "";
      const hasExpectedIncome = incomeData.hasExpectedIncome || false;
      const expectedIncome = incomeData.expectedIncome || null;

      const completedCount = [hasAccount, hasCompleteProfile, hasExpectedIncome].filter(Boolean).length;

      const newStatus = {
        hasAccount,
        hasCompleteProfile,
        hasExpectedIncome,
        completedCount,
        totalCount: 3, // Updated to include income step
        totalBalance,
        expectedIncome,
      };

      setStatus(newStatus);

      // If onboarding is complete and was dismissed, keep it dismissed
      // If onboarding is not complete but was dismissed, reset dismissal
      const dismissed = localStorage.getItem("onboarding-widget-dismissed");
      if (dismissed === "true") {
        if (completedCount === 3) { // Updated to 3 (profile, income, account)
          setIsDismissed(true);
        } else {
          // Reset dismissal if not complete
          localStorage.removeItem("onboarding-widget-dismissed");
          setIsDismissed(false);
        }
      }
    } catch (error) {
      console.error("Error checking onboarding status:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleDismiss() {
    setIsDismissed(true);
    localStorage.setItem("onboarding-widget-dismissed", "true");
  }

  async function handleAccountCreated() {
    setIsAccountFormOpen(false);
    // Wait a bit for the account to be fully created and balance to be calculated
    await new Promise(resolve => setTimeout(resolve, 500));
    // Check status after account creation
    await checkStatus();
  }

  async function handleProfileUpdated() {
    setIsProfileModalOpen(false);
    // Immediately check status after profile update
    await checkStatus();
  }

  async function handleIncomeUpdated() {
    setIsIncomeDialogOpen(false);
    // Wait a bit for the income to be fully saved
    await new Promise(resolve => setTimeout(resolve, 300));
    // Immediately check status after income update
    await checkStatus();
  }

  // Don't render if all actions are completed
  // Note: totalCount is now 3 (account, profile, income)
  if (status && status.completedCount === status.totalCount) {
    return null;
  }

  // Don't render if dismissed (only if onboarding is complete)
  if (isDismissed && status && status.completedCount === status.totalCount) {
    return null;
  }

  if (loading || !status) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="h-4 bg-muted rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const steps = [
    {
      id: "profile",
      stepNumber: 1,
      title: "Complete Profile",
      description: "Add your name to personalize your experience",
      icon: User,
      completed: status.hasCompleteProfile,
      action: () => setIsProfileModalOpen(true),
    },
    {
      id: "income",
      stepNumber: 2,
      title: "Set Expected Income",
      description: "Personalize your budgets and insights based on your expected income",
      icon: DollarSign,
      completed: status.hasExpectedIncome || false,
      action: () => setIsIncomeDialogOpen(true),
      showIncome: status.hasExpectedIncome && status.expectedIncome,
      expectedIncome: status.expectedIncome,
    },
    {
      id: "account",
      stepNumber: 3,
      title: "Connect Bank Account",
      description: "Add at least one account to start tracking your finances",
      icon: Wallet,
      completed: status.hasAccount,
      action: () => router.push("/accounts"),
      showBalance: status.hasAccount && status.totalBalance !== undefined,
      balance: status.totalBalance,
    },
  ];

  return (
    <>
      <Card className="bg-gradient-to-br from-background to-muted/20 mb-6">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <CardTitle className="text-lg font-semibold">
                Get Started
              </CardTitle>
              <CardDescription className="text-sm">
                Complete these steps to set up your account
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Timeline Steps - 3 cards side by side */}
          <div className="relative">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isLast = index === steps.length - 1;
                const nextStep = !isLast ? steps[index + 1] : null;

            return (
                  <div key={step.id} className="relative">
                    {/* Connector Line (hidden on mobile, shown on desktop) */}
                    {!isLast && (
                      <div 
                        className="hidden md:block absolute top-12 h-0.5 z-0 pointer-events-none"
                        style={{ 
                          left: '100%',
                          width: '1.5rem' // gap-6 = 1.5rem
                        }}
                      >
                        <div className={cn(
                          "h-full w-full transition-colors",
                          step.completed && nextStep?.completed
                            ? "bg-sentiment-positive" 
                            : step.completed
                            ? "bg-sentiment-positive/50"
                            : "bg-border"
                        )} />
                      </div>
                    )}

                    {/* Step Card */}
                    <Card
                className={cn(
                        "relative z-10 h-full flex flex-col transition-all duration-200",
                        step.completed
                          ? "border-sentiment-positive/50 bg-sentiment-positive/5 hover:border-sentiment-positive/70 hover:bg-sentiment-positive/10"
                          : "border-border hover:border-primary/50 hover:bg-secondary/50",
                        // Only make clickable if not completed OR if it's the income step (which is always editable)
                        (step.completed && step.id !== "income") ? "" : "cursor-pointer"
                )}
                      onClick={(step.completed && step.id !== "income") ? undefined : step.action}
                      role={(step.completed && step.id !== "income") ? undefined : "button"}
                      tabIndex={(step.completed && step.id !== "income") ? undefined : 0}
                      onKeyDown={(step.completed && step.id !== "income") ? undefined : (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          step.action();
                        }
                      }}
                    >
                      <CardContent className="flex-1 flex flex-col px-4 md:px-6 py-4 md:py-6">
                      {/* Step Number, Title & Icon */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3 flex-1">
                          <div className={cn(
                            "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all flex-shrink-0",
                            step.completed
                              ? "bg-sentiment-positive border-sentiment-positive text-white"
                              : "bg-background border-border text-muted-foreground"
                          )}>
                            {step.completed ? (
                              <CheckCircle2 className="h-5 w-5" />
                            ) : (
                              <span className="text-sm font-semibold">{step.stepNumber}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <h4 className={cn(
                              "text-base font-semibold",
                              step.completed ? "text-foreground" : "text-foreground"
                            )}>
                              {step.title}
                            </h4>
                          </div>
                        </div>
                        {/* Show edit icon only for income step when completed, or for any step when not completed */}
                        {step.completed && step.id === "income" && (
                          <div className={cn(
                            "p-2 rounded-lg transition-colors flex-shrink-0 bg-sentiment-positive/10 text-sentiment-positive dark:text-sentiment-positive"
                          )}>
                            <Pencil className="h-5 w-5" />
                          </div>
                        )}
                        {!step.completed && (
                          <div className={cn(
                            "p-2 rounded-lg transition-colors flex-shrink-0 bg-muted text-muted-foreground"
                          )}>
                            <Pencil className="h-5 w-5" />
                          </div>
                        )}
                      </div>

                      {/* Step Content */}
                      <div className="space-y-2 flex-1 flex flex-col">
                        <p className="text-sm text-muted-foreground leading-relaxed hidden md:block">
                          {step.description}
                  </p>

                        {/* Balance Display (only for account step) */}
                        {step.showBalance && step.balance !== undefined && (
                          <div className="mt-3 pt-3 border-t border-border/50">
                            <p className="text-xs text-muted-foreground mb-1">Total Balance</p>
                            <p className="text-lg font-bold text-foreground">
                              {formatMoney(step.balance)}
                      </p>
                    </div>
                  )}

                        {/* Income Display (only for income step) */}
                        {step.showIncome && step.expectedIncome && (
                          <div className="mt-3 pt-3 border-t border-border/50">
                            <p className="text-xs text-muted-foreground mb-1">Annual Household Income</p>
                            <p className="text-sm font-semibold text-foreground">
                              {formatIncomeRange(step.expectedIncome as ExpectedIncomeRange)}
                      </p>
                    </div>
                  )}

                      </div>
                      </CardContent>
                    </Card>
              </div>
            );
          })}
            </div>
          </div>
        </CardContent>
      </Card>

      <AccountForm
        open={isAccountFormOpen}
        onOpenChange={setIsAccountFormOpen}
        onSuccess={handleAccountCreated}
      />

      <ProfileModal
        open={isProfileModalOpen}
        onOpenChange={setIsProfileModalOpen}
        onSuccess={handleProfileUpdated}
      />

      <IncomeOnboardingDialog
        open={isIncomeDialogOpen}
        onOpenChange={setIsIncomeDialogOpen}
        onSuccess={handleIncomeUpdated}
      />
    </>
  );
}
