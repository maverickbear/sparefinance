"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { PersonalDataStep } from "./personal-data-step";
import { IncomeOnboardingForm } from "./income-onboarding-form";
import { BudgetRuleSelector } from "@/src/presentation/components/features/budgets/budget-rule-selector";
import { PlanSelectionStep } from "./plan-selection-step";
import { OnboardingLoadingStep } from "./onboarding-loading-step";
import { OnboardingSuccessStep } from "./onboarding-success-step";
import { useToast } from "@/components/toast-provider";
import { ExpectedIncomeRange } from "@/src/domain/onboarding/onboarding.types";
import { BudgetRuleType } from "@/src/domain/budgets/budget-rules.types";
import { CustomOnboardingDialog } from "./custom-onboarding-dialog";
import { useSubscriptionContext } from "@/contexts/subscription-context";
import { logger } from "@/src/infrastructure/utils/logger";

interface MultiStepOnboardingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

type Step = 1 | 2 | 3 | 4 | 5;

const SESSION_STORAGE_KEY = "onboarding-temp-data";

interface Step1Data {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  phoneNumber?: string | null;
  dateOfBirth?: string | null;
}

export function MultiStepOnboardingDialog({
  open,
  onOpenChange,
  onComplete,
}: MultiStepOnboardingDialogProps) {
  const { toast } = useToast();
  const router = useRouter();
  const { subscription, plan, refetch } = useSubscriptionContext();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const step1FormRef = useRef<HTMLFormElement>(null);

  // Step 1 state
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [step1Completed, setStep1Completed] = useState(false);
  const [step1FormValid, setStep1FormValid] = useState(false);

  // Step 2 state (Income + Location)
  const [selectedIncome, setSelectedIncome] = useState<ExpectedIncomeRange>(null);
  const [selectedCustomIncome, setSelectedCustomIncome] = useState<number | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{ country: string; stateOrProvince: string | null } | null>(null);
  const [selectedRule, setSelectedRule] = useState<BudgetRuleType | undefined>(undefined);
  const [recommendedRule, setRecommendedRule] = useState<BudgetRuleType | undefined>(undefined);
  const [step2SubStep, setStep2SubStep] = useState<"income" | "rule">("income");
  const [step2Completed, setStep2Completed] = useState(false);

  // Step 3 state (Plan)
  const [step3Completed, setStep3Completed] = useState(false);
  const [currentPlanId, setCurrentPlanId] = useState<string | undefined>(undefined);
  const [currentInterval, setCurrentInterval] = useState<"month" | "year" | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | undefined>(undefined);
  const [selectedInterval, setSelectedInterval] = useState<"month" | "year" | null>(null);

  // Track if we've already restored data to prevent multiple restorations
  const hasRestoredRef = useRef(false);
  
  // Reset state when dialog opens and restore from sessionStorage
  useEffect(() => {
    if (open && !hasRestoredRef.current) {
      hasRestoredRef.current = true;
      
      // Try to restore from sessionStorage
      const savedData = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          if (parsed.step1) {
            setStep1Data(parsed.step1);
            setStep1Completed(!!parsed.step1?.name);
          }
          if (parsed.step2) {
            setSelectedIncome(parsed.step2.incomeRange || null);
            setSelectedCustomIncome(parsed.step2.incomeAmount ?? null);
            setSelectedLocation(parsed.step2.location || null);
            setSelectedRule(parsed.step2.ruleType);
            setStep2Completed(!!parsed.step2?.incomeRange && !!parsed.step2?.ruleType);
            // Only restore to "rule" substep if user had already selected a rule
            // (meaning they had clicked Continue on the income step)
            if (parsed.step2.ruleType) {
              setStep2SubStep("rule");
            } else {
              // Keep user on income step so they can review and click Continue
              setStep2SubStep("income");
            }
          }
          if (parsed.step3) {
            setSelectedPlanId(parsed.step3.planId);
            setSelectedInterval(parsed.step3.interval);
            setStep3Completed(!!parsed.step3?.planId && !!parsed.step3?.interval);
          }
          // Restore currentStep if it was saved
          if (parsed.currentStep && typeof parsed.currentStep === 'number' && parsed.currentStep >= 1 && parsed.currentStep <= 5) {
            setCurrentStep(parsed.currentStep as Step);
          }
        } catch (error) {
          logger.error("Error restoring onboarding data:", error);
        }
      }
      
      loadProfile();
      // Refetch subscription to ensure we have latest data
      refetch();
    } else if (!open) {
      // Reset the flag when dialog closes so we can restore again when it opens
      hasRestoredRef.current = false;
    }
  }, [open, refetch]);

  // Save to sessionStorage whenever data changes (with debouncing to prevent loops)
  const previousDataRef = useRef<string | null>(null);
  useEffect(() => {
    if (open && (step1Data || selectedIncome || selectedPlanId)) {
      const dataToSave = {
        step1: step1Data,
        step2: selectedIncome ? { 
          incomeRange: selectedIncome, 
          incomeAmount: selectedCustomIncome,
          location: selectedLocation,
          ruleType: selectedRule 
        } : null,
        step3: selectedPlanId ? { planId: selectedPlanId, interval: selectedInterval } : null,
        currentStep: currentStep, // Save current step to restore navigation state
      };
      const dataString = JSON.stringify(dataToSave);
      
      // Only save if data actually changed to prevent infinite loops
      if (previousDataRef.current !== dataString) {
        previousDataRef.current = dataString;
        sessionStorage.setItem(SESSION_STORAGE_KEY, dataString);
      }
    }
  }, [open, step1Data, selectedIncome, selectedCustomIncome, selectedLocation, selectedRule, selectedPlanId, selectedInterval, currentStep]);

  // Get recommended rule when income is selected
  useEffect(() => {
    if (selectedIncome && step2SubStep === "income" && currentStep === 2) {
      async function getRecommendedRule() {
        try {
          const response = await fetch(`/api/v2/budgets/rules/suggest?incomeRange=${selectedIncome}`);
          if (response.ok) {
            const data = await response.json();
            setRecommendedRule(data.rule.id);
            // No card should be selected by default
          }
        } catch (error) {
          logger.error("Error getting recommended rule:", error);
        }
      }
      getRecommendedRule();
    }
  }, [selectedIncome, step2SubStep, currentStep]);

  async function loadProfile() {
    try {
      const res = await fetch("/api/v2/profile");
      if (res.ok) {
        const profile = await res.json();
        setStep1Data({
          name: profile.name,
          email: profile.email,
          avatarUrl: profile.avatarUrl,
          phoneNumber: profile.phoneNumber,
          dateOfBirth: profile.dateOfBirth,
        });
        // Check if step 1 is already completed (name is the only required field)
        if (profile.name) {
          setStep1Completed(true);
        }
      }
    } catch (error) {
      logger.error("Error loading profile:", error);
    }
  }

  // Load current plan from Context
  useEffect(() => {
    if (plan && subscription) {
      setCurrentPlanId(plan.id);
      setCurrentInterval((subscription as any).interval || null);
      setStep3Completed(true);
    } else {
      // If no plan in Context, try to refetch
      refetch();
    }
  }, [plan, subscription, refetch]);

  const handleLocationChange = useCallback((location: { country: "US" | "CA"; stateOrProvince?: string | null | undefined }) => {
    setSelectedLocation((prev) => {
      // Only update if the location actually changed
      if (!prev || prev.country !== location.country || prev.stateOrProvince !== location.stateOrProvince) {
        return {
          country: location.country,
          stateOrProvince: location.stateOrProvince ?? null,
        };
      }
      return prev;
    });
  }, []);

  function handleStep1Complete(data: Step1Data) {
    setStep1Data(data);
    setStep1Completed(true);
    // Auto-advance to step 2 (income + location)
    setCurrentStep(2);
    // Save to sessionStorage
    const savedData = sessionStorage.getItem(SESSION_STORAGE_KEY);
    const parsed = savedData ? JSON.parse(savedData) : {};
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
      ...parsed,
      step1: data,
      currentStep: 2, // Save current step
    }));
  }

  function handleStep2IncomeNext() {
    if (!selectedIncome) {
      toast({
        title: "Please select an income range",
        description: "Select your expected annual household income to continue.",
        variant: "destructive",
      });
      return;
    }
    setStep2SubStep("rule");
  }

  function handleStep2Submit() {
    if (!selectedIncome) {
      toast({
        title: "Please select an income range",
        description: "Select your expected annual household income to continue.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedRule) {
      toast({
        title: "Please select a budget rule",
        description: "Select a budget rule to continue.",
        variant: "destructive",
      });
      return;
    }

    // Validate location (country and state/province are required)
    if (!selectedLocation || !selectedLocation.country || !selectedLocation.stateOrProvince) {
      toast({
        title: "Please complete your location",
        description: "Select your country and state/province to continue.",
        variant: "destructive",
      });
      // Go back to income substep so user can complete location
      setStep2SubStep("income");
      return;
    }

    // Just store the data, don't save to backend yet
    setStep2Completed(true);
    setCurrentStep(3); // Advance to Plan Selection (step 3)
    // Save to sessionStorage
    const savedData = sessionStorage.getItem(SESSION_STORAGE_KEY);
    const parsed = savedData ? JSON.parse(savedData) : {};
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
      ...parsed,
      step2: { 
        incomeRange: selectedIncome, 
        incomeAmount: selectedCustomIncome,
        location: selectedLocation,
        ruleType: selectedRule 
      },
      currentStep: 3, // Save current step
    }));
  }

  function handlePlanSelected(planId: string, interval: "month" | "year") {
    setSelectedPlanId(planId);
    setSelectedInterval(interval);
    setStep3Completed(true);
    // Save to sessionStorage
    const savedData = sessionStorage.getItem(SESSION_STORAGE_KEY);
    const parsed = savedData ? JSON.parse(savedData) : {};
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
      ...parsed,
      step3: { planId, interval },
      currentStep: 4, // Save current step
    }));
    // Automatically advance to loading step when plan is selected
    setCurrentStep(4);
  }

  async function handleFinalSubmit() {
    // Validate all data is present
    if (!step1Data?.name) {
      toast({
        title: "Missing information",
        description: "Please complete all steps before continuing.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedIncome || !selectedRule) {
      toast({
        title: "Missing information",
        description: "Please complete all steps before continuing.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedPlanId || !selectedInterval) {
      toast({
        title: "Missing information",
        description: "Please select a plan before continuing.",
        variant: "destructive",
      });
      return;
    }

    // Move to loading step
    setCurrentStep(4);
  }

  const loadingCompleteRef = useRef(false);
  
  function handleLoadingComplete() {
    // Prevent multiple calls
    if (loadingCompleteRef.current) {
      logger.info("[MuliStepOnboardingDialog] Loading already completed, skipping");
      return;
    }
    loadingCompleteRef.current = true;

    // Clear sessionStorage
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    sessionStorage.setItem("onboarding-recently-completed", Date.now().toString());
    
    // Advance to success step instead of redirecting
    setCurrentStep(5);
  }

  async function handleGoToDashboard() {
    // Close the dialog first
    onOpenChange(false);
    
    // Trigger confetti animation after dialog closes
    try {
      const confettiModule = await import("canvas-confetti");
      const confetti = confettiModule.default;
      
      // Small delay to ensure dialog is closed before confetti starts
      setTimeout(() => {
        const duration = 3000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

        function randomInRange(min: number, max: number) {
          return Math.random() * (max - min) + min;
        }

        const interval = setInterval(function() {
          const timeLeft = animationEnd - Date.now();

          if (timeLeft <= 0) {
            clearInterval(interval);
            return;
          }

          const particleCount = 50 * (timeLeft / duration);
          
          // Launch confetti from left
          confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
          });
          
          // Launch confetti from right
          confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
          });
        }, 250);
      }, 100);
    } catch (error) {
      logger.error("[ONBOARDING] Failed to load confetti:", error);
    }
    
    // CRITICAL: Refresh subscription state before redirecting
    // This ensures the subscription is immediately available after onboarding
    if (typeof window !== 'undefined') {
      // Dispatch custom event to trigger subscription refresh
      window.dispatchEvent(new CustomEvent('onboarding-completed'));
    }
    // Use router.refresh() to force server-side revalidation
    router.refresh();
    router.push("/dashboard");
    if (onComplete) {
      onComplete();
    }
  }

  function handleGoToBilling() {
    onOpenChange(false);
    // CRITICAL: Refresh subscription state before redirecting
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('onboarding-completed'));
    }
    router.refresh();
    router.push("/settings/billing");
    if (onComplete) {
      onComplete();
    }
  }

  function handleLoadingError(error: Error) {
    // Stay on loading step, error is handled by the component
    logger.error("Onboarding completion error:", error);
  }

  function handleBack() {
    if (currentStep === 2) {
      if (step2SubStep === "rule") {
        setStep2SubStep("income");
      } else {
        setCurrentStep(1);
      }
    } else if (currentStep === 3) {
      setCurrentStep(2);
    } else if (currentStep === 4) {
      // Can't go back from loading step
      return;
    } else if (currentStep === 5) {
      // Can't go back from success step
      return;
    }
  }

  function handleSkip() {
    if (currentStep === 1) {
      // Just mark as completed and move to next step, don't save yet
      setStep1Completed(true);
      setCurrentStep(2);
    }
  }

  function handleNext() {
    if (currentStep === 1) {
      // Step 1 completion is handled by the form submission
      // Trigger form submit when Continue button is clicked
      if (step1FormRef.current) {
        step1FormRef.current.requestSubmit();
      }
      return;
    } else if (currentStep === 2) {
      if (step2SubStep === "income") {
        handleStep2IncomeNext();
      } else {
        handleStep2Submit();
      }
    } else if (currentStep === 3) {
      // Step 3: Show "Concluir" button when plan is selected
      if (step3Completed) {
        handleFinalSubmit();
      }
    }
  }

  function canProceed(): boolean {
    if (currentStep === 1) {
      // Check if required fields are filled (only name is required)
      return Boolean(step1FormValid || step1Data?.name);
    } else if (currentStep === 2) {
      if (step2SubStep === "income") {
        return !!selectedIncome;
      } else {
        return !!selectedRule;
      }
    } else if (currentStep === 3) {
      return step3Completed;
    }
    return false;
  }

  function getStepTitle(): string {
    if (currentStep === 1) {
      return "Personal Information";
    } else if (currentStep === 2) {
      return step2SubStep === "income" ? "Annual Household Income & Location" : "Choose Your Budget Rule";
    } else if (currentStep === 3) {
      return "Select a Plan";
    } else if (currentStep === 4) {
      return "Preparing Your Platform";
    } else {
      return "Welcome to Spare Finance!";
    }
  }

  function getStepDescription(): string {
    if (currentStep === 1) {
      return "Complete your profile to get started";
    } else if (currentStep === 2) {
      return step2SubStep === "income"
        ? "Tell us about your income and where you live to personalize your financial plan and calculate taxes."
        : "Select a budget rule that fits your lifestyle. We'll automatically generate budgets based on your after-tax income.";
    } else if (currentStep === 3) {
      return "Choose a plan to continue. All plans include a 30-day free trial.";
    } else if (currentStep === 4) {
      return "We're personalizing your experience";
    } else {
      return "";
    }
  }

  // Prevent closing the dialog until all steps are complete
  function handleOpenChange(open: boolean) {
    // Don't allow closing during loading step
    if (currentStep === 4) {
      return;
    }
    // Allow closing on success step (step 5)
    if (currentStep === 5) {
      onOpenChange(open);
      return;
    }
    // Only allow closing if all steps are complete
    const isComplete = step1Completed && step2Completed && step3Completed;
    if (!open && isComplete) {
      onOpenChange(false);
    }
    // If trying to close but not complete, do nothing (prevent closing)
  }

  const isComplete = step1Completed && step2Completed && step3Completed;
  // Only allow closing on success step (step 5)
  const canClose = currentStep === 5;

  return (
    <CustomOnboardingDialog
      open={open}
      onOpenChange={handleOpenChange}
      maxWidth="4xl"
      preventClose={!canClose}
      onEscapeKeyDown={(e) => {
        if (!canClose) {
          e.preventDefault();
        }
      }}
      onInteractOutside={(e) => {
        if (!canClose) {
          e.preventDefault();
        }
      }}
    >
      {/* Header Section */}
      <div className="px-6 md:px-8 pt-6 md:pt-8 pb-4">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold">{getStepTitle()}</h2>
          <p className="text-sm text-muted-foreground mt-2">
            {getStepDescription()}
          </p>
        </div>
        {/* Progress bar */}
        <div className="mt-4 w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${(currentStep / 4) * 100}%` }}
          />
        </div>
      </div>

      {/* Content Section */}
      <div className="flex-1 pt-6 px-6 md:px-8 pb-6">
        {currentStep === 1 && (
          <PersonalDataStep
            onComplete={handleStep1Complete}
            initialData={step1Data || undefined}
            formRef={step1FormRef as React.RefObject<HTMLFormElement>}
            onValidationChange={setStep1FormValid}
          />
        )}

        {currentStep === 2 && (
          <div className="space-y-4">
            {step2SubStep === "income" ? (
              <IncomeOnboardingForm
                hideCard
                showButtons={false}
                selectedIncome={selectedIncome}
                selectedCustomIncome={selectedCustomIncome}
                selectedCountry={selectedLocation?.country || null}
                selectedStateOrProvince={selectedLocation?.stateOrProvince || null}
                onIncomeChange={setSelectedIncome}
                onCustomIncomeChange={setSelectedCustomIncome}
                onLocationChange={handleLocationChange}
              />
            ) : (
              <BudgetRuleSelector
                selectedRule={selectedRule}
                recommendedRule={recommendedRule}
                onSelect={(rule) => setSelectedRule(rule.id)}
                loading={loading}
              />
            )}
          </div>
        )}

        {currentStep === 3 && (
          <PlanSelectionStep
            onPlanSelected={handlePlanSelected}
            currentPlanId={currentPlanId}
            currentInterval={currentInterval}
            selectedPlanId={selectedPlanId}
            selectedInterval={selectedInterval}
          />
        )}

        {currentStep === 4 && (
          <OnboardingLoadingStep
            key="onboarding-loading" // Key to prevent remounting
            onComplete={handleLoadingComplete}
            onError={handleLoadingError}
            step1Data={step1Data ? {
              name: step1Data.name,
              phoneNumber: step1Data.phoneNumber,
              dateOfBirth: step1Data.dateOfBirth,
              avatarUrl: step1Data.avatarUrl,
            } : undefined}
            step2Data={selectedIncome ? { 
              incomeRange: selectedIncome, 
              incomeAmount: selectedCustomIncome,
              location: selectedLocation ?? undefined,
              ruleType: selectedRule,
            } : undefined}
            step3Data={selectedPlanId && selectedInterval ? { planId: selectedPlanId, interval: selectedInterval } : undefined}
          />
        )}

        {currentStep === 5 && (
          <OnboardingSuccessStep
            onGoToDashboard={handleGoToDashboard}
            onGoToBilling={handleGoToBilling}
          />
        )}
      </div>

      {/* Footer Section */}
      <div className="px-6 md:px-8 pt-4 pb-6 md:pb-8 border-t">
        <div className="flex items-center justify-between gap-2 w-full">
          <div>
            {currentStep > 1 && currentStep < 5 && (
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={loading}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {currentStep < 5 && (
              <>
                {currentStep === 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSkip}
                    disabled={loading}
                  >
                    Skip
                  </Button>
                )}
                {currentStep === 3 ? (
                  <Button
                    type="button"
                    onClick={handleNext}
                    disabled={loading || !canProceed()}
                  >
                    Concluir
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleNext}
                    disabled={loading || !canProceed()}
                  >
                    {currentStep === 2 && step2SubStep === "income" ? "Next" : "Continue"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </CustomOnboardingDialog>
  );
}

