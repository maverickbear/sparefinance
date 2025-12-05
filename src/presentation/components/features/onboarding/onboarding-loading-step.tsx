"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CompleteOnboardingRequest } from "@/src/domain/onboarding/onboarding.types";
import { ExpectedIncomeRange } from "@/src/domain/onboarding/onboarding.types";
import { BudgetRuleType } from "@/src/domain/budgets/budget-rules.types";

interface OnboardingLoadingStepProps {
  onComplete?: () => void;
  onError?: (error: Error) => void;
  step1Data?: {
    name?: string | null;
    phoneNumber?: string | null;
    dateOfBirth?: string | null;
    avatarUrl?: string | null;
  };
  step2Data?: {
    incomeRange?: ExpectedIncomeRange;
    incomeAmount?: number | null;
    location?: {
      country: string;
      stateOrProvince: string | null;
    };
    ruleType?: BudgetRuleType | string;
  };
  step3Data?: {
    planId?: string;
    interval?: "month" | "year" | null;
  };
}

type StepStatus = "pending" | "loading" | "success" | "error";

interface Step {
  id: string;
  label: string;
  status: StepStatus;
  error?: string;
}

const STEPS: Omit<Step, "status" | "error">[] = [
  { id: "profile", label: "Saving your personal data" },
  { id: "income", label: "Setting up your expected income" },
  { id: "budgets", label: "Creating your initial budgets" },
  { id: "subscription", label: "Activating your subscription" },
  { id: "finalize", label: "Finalizing setup" },
];

export function OnboardingLoadingStep({
  onComplete,
  onError,
  step1Data,
  step2Data,
  step3Data,
}: OnboardingLoadingStepProps) {
  const [steps, setSteps] = useState<Step[]>(
    STEPS.map((step) => ({ ...step, status: "pending" as StepStatus }))
  );
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [overallError, setOverallError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const hasStartedRef = useRef(false);
  const isProcessingRef = useRef(false);
  const maxRetries = 3;

  useEffect(() => {
    // Check if already processing or completed in sessionStorage
    const processingKey = "onboarding-processing";
    const isAlreadyProcessing = sessionStorage.getItem(processingKey) === "true";
    
    console.log("[OnboardingLoadingStep] useEffect triggered", {
      hasStarted: hasStartedRef.current,
      isAlreadyProcessing,
      isComplete,
      step1Data: !!step1Data,
      step2Data: !!step2Data,
      step3Data: !!step3Data,
    });
    
    // If there's a stale processing flag but we haven't started, clear it and start fresh
    // This handles cases where a previous attempt failed or was interrupted
    if (isAlreadyProcessing && !hasStartedRef.current && !isComplete) {
      console.log("[OnboardingLoadingStep] Found stale processing flag, clearing and starting fresh");
      sessionStorage.removeItem(processingKey);
    }
    
    // Only start if not already started and not already processing and we have all required data
    const hasAllRequiredData = step1Data && step2Data && step3Data;
    
    if (!hasStartedRef.current && !isAlreadyProcessing && !isComplete && hasAllRequiredData) {
      console.log("[OnboardingLoadingStep] Starting processing...");
      hasStartedRef.current = true;
      sessionStorage.setItem(processingKey, "true");
      setIsProcessing(true);
      startProcessing();
    } else if (isAlreadyProcessing && !hasStartedRef.current && !isComplete) {
      // If already processing but component remounted, try to continue
      // But first check if we have the data needed
      const hasData = (step1Data && step2Data && step3Data) || sessionStorage.getItem("onboarding-temp-data");
      if (hasData) {
        console.log("[OnboardingLoadingStep] Already processing, marking as started and continuing");
        hasStartedRef.current = true;
        setIsProcessing(true);
        // Try to continue processing
        startProcessing();
      } else {
        console.log("[OnboardingLoadingStep] Already processing but no data found, clearing flag");
        sessionStorage.removeItem(processingKey);
        hasStartedRef.current = true;
      }
    } else {
      console.log("[OnboardingLoadingStep] Skipping start", {
        hasStarted: hasStartedRef.current,
        isAlreadyProcessing,
        isComplete,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run on mount

  async function startProcessing() {
    console.log("[OnboardingLoadingStep] startProcessing called", {
      isProcessing,
      isComplete,
      hasStarted: hasStartedRef.current,
      retryCount,
      isProcessingRef: isProcessingRef.current,
    });
    
    // Prevent multiple simultaneous calls using ref (avoids stale closure issues)
    if (isProcessingRef.current && retryCount === 0) {
      console.log("[OnboardingLoadingStep] Already processing (ref check), skipping");
      return;
    }
    
    // Check if we should skip (but don't rely on state that might be stale)
    if (isComplete) {
      console.log("[OnboardingLoadingStep] Already complete, skipping");
      return;
    }
    
    // Mark as processing using ref
    isProcessingRef.current = true;
    
    // Set the processing flag in sessionStorage to prevent duplicate calls
    const processingKey = "onboarding-processing";
    sessionStorage.setItem(processingKey, "true");

    try {
      console.log("[OnboardingLoadingStep] Starting processing logic...");
      setIsProcessing(true);
      setOverallError(null);
      
      // Reset all steps to pending
      setSteps((prev) =>
        prev.map((step) => ({ ...step, status: "pending" as StepStatus, error: undefined }))
      );

      // Get data from sessionStorage if not provided as props
      const sessionData = sessionStorage.getItem("onboarding-temp-data");
      let dataToSend: CompleteOnboardingRequest;
      
      console.log("[OnboardingLoadingStep] Checking data sources", {
        hasStep1Data: !!step1Data,
        hasStep2Data: !!step2Data,
        hasStep3Data: !!step3Data,
        hasSessionData: !!sessionData,
        step1Name: step1Data?.name,
        step2IncomeRange: step2Data?.incomeRange,
        step3PlanId: step3Data?.planId,
        step3Interval: step3Data?.interval,
      });
      
      if (step1Data && step2Data && step3Data) {
        // Use props if provided
        if (!step1Data.name || !step2Data.incomeRange || !step3Data.planId || !step3Data.interval) {
          const missingFields = [];
          if (!step1Data.name) missingFields.push("step1.name");
          if (!step2Data.incomeRange) missingFields.push("step2.incomeRange");
          if (!step3Data.planId) missingFields.push("step3.planId");
          if (!step3Data.interval) missingFields.push("step3.interval");
          console.error("[OnboardingLoadingStep] Missing required fields:", missingFields);
          throw new Error(`Missing required onboarding data: ${missingFields.join(", ")}`);
        }
        
        console.log("[OnboardingLoadingStep] Using props data");
        
        dataToSend = {
          step1: {
            name: step1Data.name,
            phoneNumber: step1Data.phoneNumber || null,
            dateOfBirth: step1Data.dateOfBirth || null,
            avatarUrl: step1Data.avatarUrl || null,
          },
          step2: {
            incomeRange: step2Data.incomeRange,
            incomeAmount: step2Data.incomeAmount || null,
            location: step2Data.location || null,
            ruleType: step2Data.ruleType,
          },
          step3: {
            planId: step3Data.planId,
            interval: step3Data.interval,
          },
        };
      } else if (sessionData) {
        // Fall back to sessionStorage
        console.log("[OnboardingLoadingStep] Using sessionStorage data");
        const parsed = JSON.parse(sessionData);
        
        // Handle migration from old step4 structure to new step3 structure
        const planData = parsed.step3 || parsed.step4; // Support both old and new structure
        
        if (!parsed.step1?.name || !parsed.step2?.incomeRange || !planData?.planId || !planData?.interval) {
          const missingFields = [];
          if (!parsed.step1?.name) missingFields.push("step1.name");
          if (!parsed.step2?.incomeRange) missingFields.push("step2.incomeRange");
          if (!planData?.planId) missingFields.push("step3.planId");
          if (!planData?.interval) missingFields.push("step3.interval");
          console.error("[OnboardingLoadingStep] Missing required fields in sessionStorage:", missingFields);
          throw new Error(`Missing required onboarding data in session storage: ${missingFields.join(", ")}`);
        }
        dataToSend = {
          step1: {
            name: parsed.step1.name,
            phoneNumber: parsed.step1.phoneNumber || null,
            dateOfBirth: parsed.step1.dateOfBirth || null,
            avatarUrl: parsed.step1.avatarUrl || null,
          },
          step2: {
            incomeRange: parsed.step2.incomeRange,
            incomeAmount: parsed.step2.incomeAmount || null,
            location: parsed.step2.location || null,
            ruleType: parsed.step2.ruleType,
          },
          step3: {
            planId: planData.planId,
            interval: planData.interval,
          },
        };
      } else {
        throw new Error("No onboarding data found");
      }

      // Process steps sequentially
      const stepOrder: Array<{ id: string; step: "profile" | "income" | "budgets" | "subscription" | "finalize" }> = [
        { id: "profile", step: "profile" },
        { id: "income", step: "income" },
        { id: "budgets", step: "budgets" },
        { id: "subscription", step: "subscription" },
        { id: "finalize", step: "finalize" },
      ];

      for (let i = 0; i < stepOrder.length; i++) {
        const { id, step } = stepOrder[i];
        
        // Mark current step as loading
        setSteps((prev) =>
          prev.map((s) =>
            s.id === id
              ? { ...s, status: "loading" as StepStatus, error: undefined }
              : s
          )
        );

        try {
          console.log(`[OnboardingLoadingStep] Processing step: ${step}`);
          
          const stepResponse = await fetch("/api/v2/onboarding/step", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              step,
              data: dataToSend,
            }),
          });

          if (!stepResponse.ok) {
            let errorData: { error?: string };
            try {
              errorData = await stepResponse.json();
            } catch {
              errorData = { error: `Failed to process ${step} step` };
            }
            
            const errorMessage = errorData.error || `Failed to process ${step} step`;
            
            // Mark current step as error
            setSteps((prev) =>
              prev.map((s) =>
                s.id === id
                  ? { ...s, status: "error" as StepStatus, error: errorMessage }
                  : s
              )
            );
            
            // Mark all subsequent steps as error
            for (let j = i + 1; j < stepOrder.length; j++) {
              setSteps((prev) =>
                prev.map((s) =>
                  s.id === stepOrder[j].id
                    ? { ...s, status: "error" as StepStatus, error: "Step skipped due to previous error" }
                    : s
                )
              );
            }
            
            throw new Error(errorMessage);
          }

          // Mark current step as success
          setSteps((prev) =>
            prev.map((s) =>
              s.id === id
                ? { ...s, status: "success" as StepStatus, error: undefined }
                : s
            )
          );

          console.log(`[OnboardingLoadingStep] Step ${step} completed successfully`);
        } catch (error) {
          console.error(`[OnboardingLoadingStep] Error processing step ${step}:`, error);
          throw error;
        }
      }

      // All steps completed successfully
      console.log("[OnboardingLoadingStep] All steps completed successfully");
      setIsComplete(true);
      setIsProcessing(false);
      isProcessingRef.current = false;
      
      // Clear processing flag
      sessionStorage.removeItem("onboarding-processing");
      console.log("[OnboardingLoadingStep] Processing complete, waiting for subscription to be available");

      // Wait a bit for subscription to be fully available in the database
      // This ensures the success page can properly detect the subscription
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Verify subscription is available before redirecting
      let subscriptionFound = false;
      let retries = 0;
      const maxRetries = 5;
      
      while (!subscriptionFound && retries < maxRetries) {
        try {
          const subscriptionCheck = await fetch("/api/v2/billing/subscription");
          if (subscriptionCheck.ok) {
            const subscriptionData = await subscriptionCheck.json();
            if (subscriptionData.subscription && 
                (subscriptionData.subscription.status === "active" || 
                 subscriptionData.subscription.status === "trialing")) {
              console.log("[OnboardingLoadingStep] Subscription found, redirecting to success page");
              subscriptionFound = true;
              break;
            } else {
              console.log(`[OnboardingLoadingStep] Subscription not found yet (attempt ${retries + 1}/${maxRetries}), waiting...`);
              retries++;
              if (retries < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
          }
        } catch (checkError) {
          console.warn("[OnboardingLoadingStep] Error checking subscription:", checkError);
          retries++;
          if (retries < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      if (!subscriptionFound) {
        console.warn("[OnboardingLoadingStep] Subscription not found after retries, but completing onboarding anyway");
      }

      // Mark as complete and call onComplete callback
      console.log("[OnboardingLoadingStep] Onboarding completed successfully");
      setIsComplete(true);
      setIsProcessing(false);
      isProcessingRef.current = false;
      
      // Clear processing flag
      sessionStorage.removeItem("onboarding-processing");
      
      // Call onComplete to advance to success step
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error("[OnboardingLoadingStep] Error completing onboarding:", error);
      console.error("[OnboardingLoadingStep] Error stack:", error instanceof Error ? error.stack : "No stack");
      setIsProcessing(false);
      isProcessingRef.current = false;
      
      // Clear processing flag on error (allow retry)
      sessionStorage.removeItem("onboarding-processing");
      
      const errorMessage =
        error instanceof Error ? error.message : "Failed to complete onboarding";

      console.error("[OnboardingLoadingStep] Error message:", errorMessage);

      // If steps weren't already updated with error status, update them now
      const hasErrorSteps = steps.some(s => s.status === "error");
      if (!hasErrorSteps) {
        // Mark all steps as error if we couldn't determine which one failed
        console.log("[OnboardingLoadingStep] Marking all steps as error");
        setSteps((prev) =>
          prev.map((step) => ({
            ...step,
            status: "error" as StepStatus,
            error: errorMessage,
          }))
        );
      }

      setOverallError(errorMessage);

      if (onError) {
        console.log("[OnboardingLoadingStep] Calling onError callback");
        onError(error instanceof Error ? error : new Error(errorMessage));
      }
    }
  }

  async function handleRetry() {
    if (retryCount >= maxRetries) {
      setOverallError("Maximum retry attempts reached. Please refresh the page and try again.");
      return;
    }

    if (isProcessing) {
      console.log("[OnboardingLoadingStep] Already processing, cannot retry");
      return;
    }

    setRetryCount((prev) => prev + 1);
    setCurrentStepIndex(0);
    setIsComplete(false);
    hasStartedRef.current = false; // Reset to allow retry
    isProcessingRef.current = false; // Reset processing ref
    sessionStorage.setItem("onboarding-processing", "true"); // Mark as processing
    await startProcessing();
    hasStartedRef.current = true; // Mark as started again
  }

  function getStepIcon(step: Step) {
    switch (step.status) {
      case "loading":
        return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
      case "success":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "error":
        return <XCircle className="h-5 w-5 text-destructive" />;
      default:
        return <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />;
    }
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 space-y-8">
      {/* Main Message */}
      <div className="text-center space-y-4">
        <h3 className="text-2xl font-semibold text-content-primary">
          We're personalizing your experience
        </h3>
      </div>

      {/* Progress Steps */}
      <div className="w-full max-w-md space-y-3">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
              step.status === "loading"
                ? "bg-primary/10"
                : step.status === "success"
                ? "bg-green-500/10"
                : step.status === "error"
                ? "bg-destructive/10"
                : "bg-muted/50"
            }`}
          >
            <div className="flex-shrink-0">{getStepIcon(step)}</div>
            <div className="flex-1">
              <p className="text-sm font-medium text-content-primary">
                {step.label}
              </p>
              {step.error && (
                <p className="text-xs text-destructive mt-1">{step.error}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Error Message */}
      {overallError && (
        <Alert variant="destructive" className="max-w-md">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Error completing onboarding</AlertTitle>
          <AlertDescription className="mt-2">
            {overallError}
            {retryCount < maxRetries && (
              <div className="mt-4">
                <Button
                  onClick={handleRetry}
                  variant="outline"
                  size="small"
                  className="w-full"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again ({retryCount + 1}/{maxRetries})
                </Button>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

    </div>
  );
}

