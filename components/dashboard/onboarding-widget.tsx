"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AccountForm } from "@/components/forms/account-form";
import { 
  Wallet, 
  User,
  CheckCircle2, 
  X,
  ArrowRight,
  Sparkles,
  DollarSign,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
// Using API routes instead of client-side APIs
import { formatMoney } from "@/components/common/money";
import { ProfileModal } from "@/components/profile/profile-modal";

interface OnboardingStatus {
  hasAccount: boolean;
  hasCompleteProfile: boolean;
  hasExpectedIncome: boolean;
  completedCount: number;
  totalCount: number;
  totalBalance?: number;
}

interface OnboardingWidgetProps {
  initialStatus?: OnboardingStatus;
}

export function OnboardingWidget({ initialStatus }: OnboardingWidgetProps) {
  const router = useRouter();
  const [status, setStatus] = useState<OnboardingStatus | null>(initialStatus || null);
  const [isAccountFormOpen, setIsAccountFormOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
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

  // Check status when page becomes visible again (user returns from income page)
  useEffect(() => {
    let mounted = true;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && mounted) {
        // Refresh status when page becomes visible (user returns from income page)
        checkStatus();
      }
    };

    // Also check on focus (when user switches back to tab)
    const handleFocus = () => {
      if (mounted) {
        checkStatus();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    
    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      // The balance should already include initialBalance from getAccountsClient,
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

      const completedCount = [hasAccount, hasCompleteProfile, hasExpectedIncome].filter(Boolean).length;

      const newStatus = {
        hasAccount,
        hasCompleteProfile,
        hasExpectedIncome,
        completedCount,
        totalCount: 3, // Updated to include income step
        totalBalance,
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
      action: () => router.push("/onboarding/income"),
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
                            ? "bg-primary" 
                            : step.completed
                            ? "bg-primary/50"
                            : "bg-border"
                        )} />
                      </div>
                    )}

                    {/* Step Card */}
                    <Card
                className={cn(
                        "relative z-10 h-full flex flex-col transition-all duration-200",
                        step.completed
                          ? "border-primary/50 bg-primary/5"
                          : "border-border hover:border-primary/50 hover:shadow-md",
                        !step.completed && "cursor-pointer"
                )}
                      onClick={!step.completed ? step.action : undefined}
                    >
                      <CardContent className="flex-1 flex flex-col">
                      {/* Step Number & Icon */}
                      <div className="flex items-center justify-between mb-4">
                <div className={cn(
                          "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all",
                          step.completed
                            ? "bg-primary border-primary text-primary-foreground"
                            : "bg-background border-border text-muted-foreground"
                )}>
                          {step.completed ? (
                            <CheckCircle2 className="h-5 w-5" />
                  ) : (
                            <span className="text-sm font-semibold">{step.stepNumber}</span>
                  )}
                </div>
                        <div className={cn(
                          "p-2 rounded-lg transition-colors",
                          step.completed
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        )}>
                          <Icon className="h-5 w-5" />
                        </div>
                      </div>

                      {/* Step Content */}
                      <div className="space-y-2 flex-1 flex flex-col">
                  <div className="flex items-center gap-2">
                    <h4 className={cn(
                            "text-base font-semibold",
                            step.completed ? "text-foreground" : "text-foreground"
                    )}>
                            {step.title}
                    </h4>
                          {step.completed && (
                            <Badge variant="secondary" className="text-xs">
                              Done
                            </Badge>
                    )}
                  </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
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

                        {/* Action Button */}
                        {!step.completed && (
                          <Button
                            variant="default"
                            size="small"
                            className="w-full mt-auto"
                            onClick={(e) => {
                              e.stopPropagation();
                              step.action();
                            }}
                          >
                            {step.id === "account" ? "Create Account" : "Get Started"}
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
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
    </>
  );
}
