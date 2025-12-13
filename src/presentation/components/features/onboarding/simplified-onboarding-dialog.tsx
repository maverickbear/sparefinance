"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Check } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { CustomOnboardingDialog } from "./custom-onboarding-dialog";
import { UserGoal, HouseholdType, SimplifiedOnboardingRequest } from "@/src/domain/onboarding/onboarding.types";

interface SimplifiedOnboardingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

const USER_GOALS: Array<{ id: UserGoal; label: string; description: string }> = [
  { id: "track-spending", label: "Track Spending", description: "See where my money goes" },
  { id: "save-money", label: "Save Money", description: "Build savings and emergency fund" },
  { id: "pay-debt", label: "Pay Debt", description: "Get out of debt faster" },
  { id: "plan-budget", label: "Plan Budget", description: "Create and stick to a budget" },
  { id: "invest-wealth", label: "Invest & Build Wealth", description: "Grow my investments" },
  { id: "household-finance", label: "Household Finance", description: "Manage finances with family" },
];

const HOUSEHOLD_TYPES: Array<{ id: HouseholdType; label: string; description: string }> = [
  { id: "personal", label: "Just Me", description: "Managing my personal finances" },
  { id: "shared", label: "Shared Household", description: "Managing finances with family or partner" },
];

type Step = "goals" | "household" | "loading";

export function SimplifiedOnboardingDialog({
  open,
  onOpenChange,
  onComplete,
}: SimplifiedOnboardingDialogProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<Step>("goals");
  const [loading, setLoading] = useState(false);
  
  // Step 1: Goals
  const [selectedGoals, setSelectedGoals] = useState<UserGoal[]>([]);
  
  // Step 2: Household Type
  const [householdType, setHouseholdType] = useState<HouseholdType | null>(null);
  

  function handleGoalToggle(goalId: UserGoal) {
    setSelectedGoals(prev => 
      prev.includes(goalId)
        ? prev.filter(id => id !== goalId)
        : [...prev, goalId]
    );
  }

  function handleNext() {
    if (currentStep === "goals") {
      if (selectedGoals.length === 0) {
        toast({
          title: "Please select at least one goal",
          variant: "destructive",
        });
        return;
      }
      setCurrentStep("household");
    } else if (currentStep === "household") {
      if (!householdType) {
        toast({
          title: "Please select a household type",
          variant: "destructive",
        });
        return;
      }
      // Complete onboarding after household selection
      handleComplete();
    }
  }


  async function handleComplete() {
    try {
      setLoading(true);
      setCurrentStep("loading");

      // Get Pro plan ID
      const plansResponse = await fetch("/api/billing/plans");
      if (!plansResponse.ok) {
        throw new Error("Failed to fetch plans");
      }
      const plansData = await plansResponse.json();
      const proPlan = plansData.plans?.find((p: any) => p.name === 'pro');
      
      if (!proPlan) {
        throw new Error("Pro plan not found");
      }

      // Prepare onboarding data
      const onboardingData: SimplifiedOnboardingRequest = {
        goals: selectedGoals,
        householdType: householdType!,
        // Income and location are optional - not collected in simplified onboarding
        incomeRange: null,
        incomeAmount: null,
        location: null,
      };

      // Complete simplified onboarding
      const response = await fetch("/api/v2/onboarding/simplified", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...onboardingData,
          planId: proPlan.id,
          interval: "month", // Default to monthly
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to complete onboarding");
      }

      toast({
        title: "Welcome to Spare Finance!",
        description: "Your 30-day free trial has started. Enjoy full access to all features!",
        variant: "success",
      });

      // Close dialog
      onOpenChange(false);
      
      // Call onComplete callback (triggers subscription refresh if needed)
      if (onComplete) {
        onComplete();
      }
      
      // Note: No router.refresh() needed - onboarding completion is now stored in household settings
      // which is checked immediately on next render. The flag is deterministic and doesn't depend on cache.
    } catch (error) {
      console.error("Error completing onboarding:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to complete onboarding",
        variant: "destructive",
      });
      setCurrentStep("household"); // Go back to household step on error
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    if (currentStep === "household") {
      setCurrentStep("goals");
    }
  }

  return (
    <CustomOnboardingDialog
      open={open}
      onOpenChange={onOpenChange}
      preventClose={loading}
      maxWidth="2xl"
    >
      <div className="flex flex-col h-full">
        {/* Progress indicator */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-2">
            {["goals", "household"].map((step, index) => {
              const stepIndex = ["goals", "household"].indexOf(currentStep);
              const isCompleted = index < stepIndex;
              const isCurrent = index === stepIndex;
              
              return (
                <div key={step} className="flex items-center flex-1">
                  <div
                    className={`h-2 flex-1 rounded-full ${
                      isCompleted || isCurrent
                        ? "bg-primary"
                        : "bg-muted"
                    }`}
                  />
                  {index < 1 && (
                    <div
                      className={`h-2 w-2 rounded-full mx-1 ${
                        isCompleted || isCurrent
                          ? "bg-primary"
                          : "bg-muted"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {currentStep === "goals" && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">What are your financial goals?</h2>
                <p className="text-muted-foreground">Select all that apply (you can change this later)</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {USER_GOALS.map((goal) => {
                  const isSelected = selectedGoals.includes(goal.id);
                  return (
                    <Card
                      key={goal.id}
                      className={`cursor-pointer transition-all ${
                        isSelected
                          ? "border-primary ring-2 ring-primary/30"
                          : "hover:border-primary/50"
                      }`}
                      onClick={() => handleGoalToggle(goal.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`mt-1 h-5 w-5 rounded border-2 flex items-center justify-center ${
                            isSelected ? "border-primary bg-primary" : "border-muted-foreground"
                          }`}>
                            {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold">{goal.label}</h3>
                            <p className="text-sm text-muted-foreground">{goal.description}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {currentStep === "household" && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">How will you use Spare Finance?</h2>
                <p className="text-muted-foreground">Choose the option that best describes your situation</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {HOUSEHOLD_TYPES.map((type) => {
                  const isSelected = householdType === type.id;
                  return (
                    <Card
                      key={type.id}
                      className={`cursor-pointer transition-all ${
                        isSelected
                          ? "border-primary ring-2 ring-primary/30"
                          : "hover:border-primary/50"
                      }`}
                      onClick={() => setHouseholdType(type.id)}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start gap-3">
                          <div className={`mt-1 h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? "border-primary bg-primary" : "border-muted-foreground"
                          }`}>
                            {isSelected && <div className="h-2 w-2 rounded-full bg-primary-foreground" />}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{type.label}</h3>
                            <p className="text-sm text-muted-foreground mt-1">{type.description}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {currentStep === "loading" && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Setting up your account...</p>
            </div>
          )}
        </div>

        {/* Footer with buttons */}
        {currentStep !== "loading" && (
          <div className="border-t px-6 py-4 flex items-center justify-between">
            <div>
              {currentStep !== "goals" && (
                <Button
                  variant="ghost"
                  onClick={handleBack}
                  disabled={loading}
                >
                  Back
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleNext}
                disabled={
                  loading ||
                  (currentStep === "goals" && selectedGoals.length === 0) ||
                  (currentStep === "household" && !householdType)
                }
              >
                {currentStep === "household" ? "Complete Setup" : "Continue"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </CustomOnboardingDialog>
  );
}
