"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AccountForm } from "@/components/forms/account-form";
import { Progress } from "@/components/ui/progress";
import { 
  Wallet, 
  User,
  CheckCircle2, 
  X,
  ArrowRight,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getAccountsClient } from "@/lib/api/accounts-client";
import { getProfileClient } from "@/lib/api/profile-client";
import { formatMoney } from "@/components/common/money";
import { ProfileModal } from "@/components/profile/profile-modal";

interface OnboardingStatus {
  hasAccount: boolean;
  hasCompleteProfile: boolean;
  completedCount: number;
  totalCount: number;
  totalBalance?: number;
}

interface OnboardingWidgetProps {
  initialStatus?: OnboardingStatus;
}

export function OnboardingWidget({ initialStatus }: OnboardingWidgetProps) {
  const [status, setStatus] = useState<OnboardingStatus | null>(initialStatus || null);
  const [isAccountFormOpen, setIsAccountFormOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [loading, setLoading] = useState(!initialStatus);

  useEffect(() => {
    // Check if widget was dismissed
    const dismissed = localStorage.getItem("onboarding-widget-dismissed");
    if (dismissed === "true") {
      setIsDismissed(true);
      return;
    }

    // Load initial status if not provided
    if (!initialStatus) {
      checkStatus();
    }
  }, [initialStatus]);

  async function checkStatus() {
    try {
      setLoading(true);
      const [accounts, profile] = await Promise.all([
        getAccountsClient(),
        getProfileClient(),
      ]);

      const hasAccount = accounts.length > 0;
      const totalBalance = hasAccount 
        ? accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0)
        : undefined;
      
      const hasCompleteProfile = profile !== null && profile.name !== null && profile.name.trim() !== "";

      const completedCount = [hasAccount, hasCompleteProfile].filter(Boolean).length;

      setStatus({
        hasAccount,
        hasCompleteProfile,
        completedCount,
        totalCount: 2,
        totalBalance,
      });
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
    // Immediately check status after account creation (no delay needed)
    await checkStatus();
  }

  async function handleProfileUpdated() {
    setIsProfileModalOpen(false);
    // Immediately check status after profile update
    await checkStatus();
  }

  // Monitor status changes and hide widget when all actions are completed
  useEffect(() => {
    if (status && status.completedCount === status.totalCount) {
      console.log("All onboarding actions completed, hiding widget");
    }
  }, [status]);

  // Don't render if dismissed
  if (isDismissed) {
    return null;
  }

  // Don't render if all actions are completed
  if (status && status.completedCount === status.totalCount) {
    return null;
  }

  if (loading || !status) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="h-4 bg-muted rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const progressPercentage = (status.completedCount / status.totalCount) * 100;

  const actions = [
    {
      id: "account",
      title: "Create Account",
      description: "Add at least one account to start tracking your finances",
      icon: Wallet,
      completed: status.hasAccount,
      action: () => setIsAccountFormOpen(true),
    },
    {
      id: "profile",
      title: "Complete Profile",
      description: "Add your name to personalize your experience",
      icon: User,
      completed: status.hasCompleteProfile,
      action: () => setIsProfileModalOpen(true),
    },
  ];

  return (
    <>
      <Card className="border-border/50 bg-gradient-to-br from-background to-muted/20">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <CardTitle className="text-lg font-semibold">
                  Get Started
                </CardTitle>
              </div>
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
          <div className="pt-2 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {status.completedCount} of {status.totalCount} completed
              </span>
              <span className="font-medium text-foreground">
                {Math.round(progressPercentage)}%
              </span>
            </div>
            <Progress value={progressPercentage} className="h-1.5" />
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {actions.map((action) => {
            const Icon = action.icon;

            return (
              <div
                key={action.id}
                className={cn(
                  "group relative flex items-start gap-3 p-3 rounded-lg transition-all duration-200",
                  action.completed
                    ? "bg-muted/30 border border-border/50"
                    : "bg-background border border-border/50 hover:border-border hover:shadow-sm"
                )}
              >
                <div className={cn(
                  "mt-0.5 shrink-0 transition-colors",
                  action.completed 
                    ? "text-primary" 
                    : "text-muted-foreground group-hover:text-foreground"
                )}>
                  {action.completed ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h4 className={cn(
                      "text-sm font-medium transition-colors",
                      action.completed 
                        ? "text-foreground" 
                        : "text-foreground"
                    )}>
                      {action.title}
                    </h4>
                    {action.completed && (
                      <span className="text-xs text-primary font-medium">Done</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {action.description}
                  </p>
                  {action.id === "account" && action.completed && status.totalBalance !== undefined && (
                    <div className="mt-1.5 pt-1.5 border-t border-border/50">
                      <p className="text-xs text-muted-foreground">Total Balance</p>
                      <p className="text-sm font-semibold text-foreground">
                        {formatMoney(status.totalBalance)}
                      </p>
                    </div>
                  )}
                </div>
                {!action.completed && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={action.action}
                    className="shrink-0 h-7 text-xs"
                  >
                    {action.id === "account" ? "Create" : "Complete"}
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                )}
              </div>
            );
          })}
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
