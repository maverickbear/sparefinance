/**
 * useOnboardingDialog Hook
 * 
 * Presentation layer hook for managing onboarding dialog state
 * Uses OnboardingDecisionService via API route
 * 
 * This hook separates presentation logic from business logic:
 * - Business logic: OnboardingDecisionService (Application Layer)
 * - Presentation logic: This hook (Presentation Layer)
 * - UI: Components that use this hook
 */

import { useState, useEffect } from "react";

interface UseOnboardingDialogOptions {
  /**
   * Initial shouldShow value from server (SSR)
   * If provided, hook will use this initially and then check in background
   */
  initialShouldShow?: boolean;
  /**
   * Whether to check status in background
   * Default: true
   */
  checkInBackground?: boolean;
}

interface UseOnboardingDialogResult {
  /**
   * Whether the onboarding dialog should be shown
   */
  shouldShow: boolean;
  /**
   * Whether the check is in progress
   */
  checking: boolean;
  /**
   * Error if check failed
   */
  error: Error | null;
  /**
   * Manually refresh the decision
   */
  refresh: () => Promise<void>;
}

/**
 * Hook for managing onboarding dialog visibility
 * 
 * @param options - Configuration options
 * @returns Object with shouldShow, checking, error, and refresh function
 * 
 * @example
 * ```typescript
 * const { shouldShow, checking } = useOnboardingDialog({
 *   initialShouldShow: true,
 *   checkInBackground: true
 * });
 * 
 * return shouldShow ? <OnboardingDialog /> : null;
 * ```
 */
export function useOnboardingDialog(
  options: UseOnboardingDialogOptions = {}
): UseOnboardingDialogResult {
  const { initialShouldShow, checkInBackground = true } = options;
  const [shouldShow, setShouldShow] = useState(initialShouldShow ?? false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const checkShouldShow = async () => {
    setChecking(true);
    setError(null);
    
    try {
      const response = await fetch("/api/v2/onboarding/should-show");
      if (!response.ok) {
        throw new Error(`Failed to check onboarding status: ${response.status}`);
      }
      
      const data = await response.json();
      setShouldShow(data.shouldShow);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      // On error, default to showing onboarding (safer for user experience)
      setShouldShow(true);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    // If we have initial value from server, use it
    // Otherwise, check immediately
    if (initialShouldShow !== undefined) {
      setShouldShow(initialShouldShow);
      
      // Optionally check in background to ensure we have latest status
      if (checkInBackground) {
        checkShouldShow();
      }
    } else {
      // No initial value, check immediately
      checkShouldShow();
    }
  }, []); // Only run on mount

  return {
    shouldShow,
    checking,
    error,
    refresh: checkShouldShow,
  };
}

