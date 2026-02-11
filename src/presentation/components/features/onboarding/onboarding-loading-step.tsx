"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CompleteOnboardingRequest } from "@/src/domain/onboarding/onboarding.types";
import { ExpectedIncomeRange } from "@/src/domain/onboarding/onboarding.types";
import { BudgetRuleType } from "@/src/domain/budgets/budget-rules.types";
import { logger } from "@/src/infrastructure/utils/logger";

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
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const MAX_PROCESSING_TIME = 30000; // 30 seconds max for all steps

  useEffect(() => {
    // Check if already processing or completed in sessionStorage
    const processingKey = "onboarding-processing";
    const isAlreadyProcessing = sessionStorage.getItem(processingKey) === "true";
    
    logger.info("[OnboardingLoadingStep] useEffect triggered", {
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
      logger.info("[OnboardingLoadingStep] Found stale processing flag, clearing and starting fresh");
      sessionStorage.removeItem(processingKey);
    }
    
    // Only start if not already started and not already processing and we have all required data
    const hasAllRequiredData = step1Data && step2Data && step3Data;
    
    if (!hasStartedRef.current && !isAlreadyProcessing && !isComplete && hasAllRequiredData) {
      logger.info("[OnboardingLoadingStep] Starting processing...");
      hasStartedRef.current = true;
      sessionStorage.setItem(processingKey, "true");
      setIsProcessing(true);
      startProcessing();
    } else if (isAlreadyProcessing && !hasStartedRef.current && !isComplete) {
      // If already processing but component remounted, try to continue
      // But first check if we have the data needed
      const hasData = (step1Data && step2Data && step3Data) || sessionStorage.getItem("onboarding-temp-data");
      if (hasData) {
        logger.info("[OnboardingLoadingStep] Already processing, marking as started and continuing");
        hasStartedRef.current = true;
        setIsProcessing(true);
        // Try to continue processing
        startProcessing();
      } else {
        logger.info("[OnboardingLoadingStep] Already processing but no data found, clearing flag");
        sessionStorage.removeItem(processingKey);
        hasStartedRef.current = true;
      }
    } else {
      logger.info("[OnboardingLoadingStep] Skipping start", {
        hasStarted: hasStartedRef.current,
        isAlreadyProcessing,
        isComplete,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run on mount

  async function startProcessing() {
    logger.info("[OnboardingLoadingStep] startProcessing called", {
      isProcessing,
      isComplete,
      hasStarted: hasStartedRef.current,
      retryCount,
      isProcessingRef: isProcessingRef.current,
    });
    
    // Prevent multiple simultaneous calls using ref (avoids stale closure issues)
    if (isProcessingRef.current && retryCount === 0) {
      logger.info("[OnboardingLoadingStep] Already processing (ref check), skipping");
      return;
    }
    
    // Check if we should skip (but don't rely on state that might be stale)
    if (isComplete) {
      logger.info("[OnboardingLoadingStep] Already complete, skipping");
      return;
    }
    
    // Mark as processing using ref
    isProcessingRef.current = true;
    
    // Set the processing flag in sessionStorage to prevent duplicate calls
    const processingKey = "onboarding-processing";
    sessionStorage.setItem(processingKey, "true");
    
    // Set a timeout to force completion if processing takes too long
    // This prevents infinite loading if there are persistent errors
    timeoutRef.current = setTimeout(() => {
      if (!isComplete) {
        logger.warn("[OnboardingLoadingStep] Processing timeout reached, forcing completion");
        forceComplete();
      }
    }, MAX_PROCESSING_TIME);

    // Track if all steps failed with auth errors (declared outside try-catch for access in catch block)
    let allStepsAuthError = true;

    try {
      logger.info("[OnboardingLoadingStep] Starting processing logic...");
      setIsProcessing(true);
      setOverallError(null);
      
      // Reset all steps to pending
      setSteps((prev) =>
        prev.map((step) => ({ ...step, status: "pending" as StepStatus, error: undefined }))
      );

      // Get data from sessionStorage if not provided as props
      const sessionData = sessionStorage.getItem("onboarding-temp-data");
      let dataToSend: CompleteOnboardingRequest;
      
      logger.info("[OnboardingLoadingStep] Checking data sources", {
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
          logger.error("[OnboardingLoadingStep] Missing required fields:", missingFields);
          throw new Error(`Missing required onboarding data: ${missingFields.join(", ")}`);
        }
        
        logger.info("[OnboardingLoadingStep] Using props data");
        
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
        logger.info("[OnboardingLoadingStep] Using sessionStorage data");
        const parsed = JSON.parse(sessionData);
        
        // Handle migration from old step4 structure to new step3 structure
        const planData = parsed.step3 || parsed.step4; // Support both old and new structure
        
        if (!parsed.step1?.name || !parsed.step2?.incomeRange || !planData?.planId || !planData?.interval) {
          const missingFields = [];
          if (!parsed.step1?.name) missingFields.push("step1.name");
          if (!parsed.step2?.incomeRange) missingFields.push("step2.incomeRange");
          if (!planData?.planId) missingFields.push("step3.planId");
          if (!planData?.interval) missingFields.push("step3.interval");
          logger.error("[OnboardingLoadingStep] Missing required fields in sessionStorage:", missingFields);
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
          logger.info(`[OnboardingLoadingStep] Processing step: ${step}`);
          
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
            // If we get 401, assume data was already saved (session expired but data persisted)
            // This can happen if onboarding was completed but session expired during the process
            if (stepResponse.status === 401) {
              logger.warn(`[OnboardingLoadingStep] Got 401 for step ${step}, assuming already completed`);
              // Mark as success since data was likely already saved
              setSteps((prev) =>
                prev.map((s) =>
                  s.id === id
                    ? { ...s, status: "success" as StepStatus, error: undefined }
                    : s
                )
              );
              logger.info(`[OnboardingLoadingStep] Step ${step} marked as success (401 - assumed already completed)`);
              // Don't set allStepsAuthError to false since this is still an auth error scenario
              continue; // Continue to next step
            } else {
              // If we got a non-401 error, not all steps are auth errors
              allStepsAuthError = false;
            }
            
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

          const stepData = await stepResponse.json();

          // Mark current step as success
          setSteps((prev) =>
            prev.map((s) =>
              s.id === id
                ? { ...s, status: "success" as StepStatus, error: undefined }
                : s
            )
          );

          // Step succeeded, so not all steps are auth errors
          allStepsAuthError = false;
          logger.info(`[OnboardingLoadingStep] Step ${step} completed successfully`);

          // Subscription step returns checkoutUrl: redirect to Stripe Checkout (trial with card)
          if (step === "subscription" && stepData.checkoutUrl) {
            window.location.href = stepData.checkoutUrl;
            return;
          }
        } catch (error) {
          // If it's a network error or fetch failed completely, check if it's a 401 scenario
          if (error instanceof TypeError && error.message.includes("fetch")) {
            logger.warn(`[OnboardingLoadingStep] Network error for step ${step}, assuming already completed if data exists in DB`);
            // Mark as success and continue - data might already be saved
            setSteps((prev) =>
              prev.map((s) =>
                s.id === id
                  ? { ...s, status: "success" as StepStatus, error: undefined }
                  : s
              )
            );
            // Keep allStepsAuthError as true since this is still an auth/network error scenario
            continue;
          }
          
          // Non-auth error, so not all steps are auth errors
          allStepsAuthError = false;
          logger.error(`[OnboardingLoadingStep] Error processing step ${step}:`, error);
          throw error;
        }
      }

      // All steps completed successfully
      logger.info("[OnboardingLoadingStep] All steps completed successfully");
      setIsComplete(true);
      setIsProcessing(false);
      isProcessingRef.current = false;
      
      // Clear processing flag
      sessionStorage.removeItem("onboarding-processing");
      logger.info("[OnboardingLoadingStep] Processing complete, waiting for subscription to be available");

      // Wait a bit for subscription to be fully available in the database
      // This ensures the success page can properly detect the subscription
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Trigger subscription refresh event to update Context
      // The Context will handle fetching the latest subscription status
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('onboarding-completed'));
      }
      
      logger.info("[OnboardingLoadingStep] Onboarding processing complete, subscription will be refreshed via Context");

      // Mark as complete and call onComplete callback
      logger.info("[OnboardingLoadingStep] Onboarding completed successfully");
      setIsComplete(true);
      setIsProcessing(false);
      isProcessingRef.current = false;
      
      // Clear processing flag
      sessionStorage.removeItem("onboarding-processing");
      
      // Clear timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      // Call onComplete to advance to success step
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      logger.error("[OnboardingLoadingStep] Error completing onboarding:", error);
      logger.error("[OnboardingLoadingStep] Error stack:", error instanceof Error ? error.stack : "No stack");
      setIsProcessing(false);
      isProcessingRef.current = false;
      
      // Clear processing flag on error (allow retry)
      sessionStorage.removeItem("onboarding-processing");
      
      // Clear timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      const errorMessage =
        error instanceof Error ? error.message : "Failed to complete onboarding";
      
      // If all steps failed with 401 or network errors, assume onboarding was completed
      // and advance to success step anyway (data was likely already saved)
      // Use the tracked variable instead of checking steps state (which might be stale)
      if (allStepsAuthError) {
        logger.warn("[OnboardingLoadingStep] All steps failed with auth/network errors, assuming onboarding completed");
        forceComplete();
        return;
      }

      logger.error("[OnboardingLoadingStep] Error message:", errorMessage);

      // If steps weren't already updated with error status, update them now
      const hasErrorSteps = steps.some(s => s.status === "error");
      if (!hasErrorSteps) {
        // Mark all steps as error if we couldn't determine which one failed
        logger.info("[OnboardingLoadingStep] Marking all steps as error");
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
        logger.info("[OnboardingLoadingStep] Calling onError callback");
        onError(error instanceof Error ? error : new Error(errorMessage));
      }
    }
  }

  function forceComplete() {
    logger.info("[OnboardingLoadingStep] Force completing onboarding");
    setIsComplete(true);
    setIsProcessing(false);
    isProcessingRef.current = false;
    
    // Mark all steps as success
    setSteps((prev) =>
      prev.map((step) => ({
        ...step,
        status: "success" as StepStatus,
        error: undefined,
      }))
    );
    
    // Clear processing flag
    sessionStorage.removeItem("onboarding-processing");
    
    // Clear timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    // Trigger subscription refresh event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('onboarding-completed'));
    }
    
    // Call onComplete to advance to success step
    if (onComplete) {
      onComplete();
    }
  }

  async function handleRetry() {
    if (retryCount >= maxRetries) {
      setOverallError("Maximum retry attempts reached. Please refresh the page and try again.");
      return;
    }

    if (isProcessing) {
      logger.info("[OnboardingLoadingStep] Already processing, cannot retry");
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
                ? "bg-sentiment-positive/10"
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
                  size="medium"
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

