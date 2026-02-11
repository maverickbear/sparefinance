/**
 * Key and shape for plan/interval pre-selected on the landing page.
 * Persisted in sessionStorage so after signup the user is sent straight to Stripe checkout.
 */
export const LANDING_PLAN_STORAGE_KEY = "landing_plan";

export interface LandingPlanStorage {
  planId: string;
  interval: "month" | "year";
}

export function getLandingPlan(): LandingPlanStorage | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(LANDING_PLAN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LandingPlanStorage;
    if (parsed?.planId && (parsed.interval === "month" || parsed.interval === "year")) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function setLandingPlan(planId: string, interval: "month" | "year"): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      LANDING_PLAN_STORAGE_KEY,
      JSON.stringify({ planId, interval } satisfies LandingPlanStorage)
    );
  } catch {
    // ignore
  }
}

export function clearLandingPlan(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(LANDING_PLAN_STORAGE_KEY);
  } catch {
    // ignore
  }
}
