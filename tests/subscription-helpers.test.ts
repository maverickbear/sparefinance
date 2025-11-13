/**
 * Subscription Helpers Tests
 * 
 * Testes unitários para funções auxiliares de subscription
 * que não requerem conexão com o banco de dados.
 */

// Helper function to check if trial is valid (same as in plans.ts)
function isTrialValid(subscription: any): boolean {
  if (subscription.status !== "trialing") {
    return true; // Not a trial, so it's valid
  }
  
  if (!subscription.trialEndDate) {
    return false; // Trial without end date is invalid
  }
  
  const trialEndDate = new Date(subscription.trialEndDate);
  const now = new Date();
  
  return trialEndDate > now; // Trial is valid if end date is in the future
}

// Helper function to check if user can write (same logic as useWriteGuard)
function canWrite(subscription: any): boolean {
  if (!subscription) {
    return false;
  }

  // User can write if subscription is active
  if (subscription.status === "active") {
    return true;
  }

  // User can write if trial is active and valid
  if (subscription.status === "trialing") {
    return isTrialValid(subscription);
  }

  // All other statuses (cancelled, past_due) block writes
  return false;
}

// Helper function to check if subscription should show upgrade banner
// Note: Only "basic" and "premium" plans exist (no "free" plan)
function shouldShowUpgradeBanner(subscription: any, plan: any): boolean {
  // Don't show if premium and active/trialing
  if (plan?.name === "premium") {
    // But show if cancelled or past_due (to reactivate)
    if (subscription?.status === "cancelled" || subscription?.status === "past_due") {
      return true;
    }
    return false;
  }

  // For basic plan, show if not active and not valid trial
  if (plan?.name === "basic") {
    // Show for cancelled or past_due
    if (subscription?.status === "cancelled" || subscription?.status === "past_due") {
      return true;
    }
    // Show for expired trial
    if (subscription?.status === "trialing" && !isTrialValid(subscription)) {
      return true;
    }
    // Don't show for active or valid trial
    return false;
  }

  // Show for cancelled, past_due, expired trial, or no subscription
  // (no subscription means user needs to select a plan)
  if (!subscription) {
    return true;
  }

  if (subscription.status === "cancelled" || subscription.status === "past_due") {
    return true;
  }

  if (subscription.status === "trialing" && !isTrialValid(subscription)) {
    return true;
  }

  return false;
}

describe("Subscription Helpers", () => {
  describe("isTrialValid", () => {
    it("should return true for active subscription", () => {
      const subscription = {
        status: "active",
      };
      expect(isTrialValid(subscription)).toBe(true);
    });

    it("should return true for valid trial", () => {
      const subscription = {
        status: "trialing",
        trialEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      };
      expect(isTrialValid(subscription)).toBe(true);
    });

    it("should return false for expired trial", () => {
      const subscription = {
        status: "trialing",
        trialEndDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      };
      expect(isTrialValid(subscription)).toBe(false);
    });

    it("should return false for trial without end date", () => {
      const subscription = {
        status: "trialing",
        trialEndDate: null,
      };
      expect(isTrialValid(subscription)).toBe(false);
    });

    it("should return false for trial ending exactly now", () => {
      const subscription = {
        status: "trialing",
        trialEndDate: new Date().toISOString(), // Exactly now
      };
      expect(isTrialValid(subscription)).toBe(false);
    });

    it("should return true for cancelled subscription (not a trial)", () => {
      const subscription = {
        status: "cancelled",
      };
      expect(isTrialValid(subscription)).toBe(true);
    });
  });

  describe("canWrite", () => {
    it("should allow writes for active subscription", () => {
      const subscription = {
        status: "active",
      };
      expect(canWrite(subscription)).toBe(true);
    });

    it("should allow writes for valid trial", () => {
      const subscription = {
        status: "trialing",
        trialEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };
      expect(canWrite(subscription)).toBe(true);
    });

    it("should block writes for expired trial", () => {
      const subscription = {
        status: "trialing",
        trialEndDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      };
      expect(canWrite(subscription)).toBe(false);
    });

    it("should block writes for cancelled subscription", () => {
      const subscription = {
        status: "cancelled",
      };
      expect(canWrite(subscription)).toBe(false);
    });

    it("should block writes for past_due subscription", () => {
      const subscription = {
        status: "past_due",
      };
      expect(canWrite(subscription)).toBe(false);
    });

    it("should block writes when no subscription", () => {
      expect(canWrite(null)).toBe(false);
      expect(canWrite(undefined)).toBe(false);
    });

    it("should block writes for trial without end date", () => {
      const subscription = {
        status: "trialing",
        trialEndDate: null,
      };
      expect(canWrite(subscription)).toBe(false);
    });
  });

  describe("shouldShowUpgradeBanner", () => {
    it("should not show banner for premium plan", () => {
      const subscription = { status: "active" };
      const plan = { name: "premium" };
      expect(shouldShowUpgradeBanner(subscription, plan)).toBe(false);
    });

    it("should not show banner for active subscription", () => {
      const subscription = { status: "active" };
      const plan = { name: "basic" };
      expect(shouldShowUpgradeBanner(subscription, plan)).toBe(false);
    });

    it("should not show banner for valid trial", () => {
      const subscription = {
        status: "trialing",
        trialEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };
      const plan = { name: "basic" };
      expect(shouldShowUpgradeBanner(subscription, plan)).toBe(false);
    });

    it("should show banner for expired trial", () => {
      const subscription = {
        status: "trialing",
        trialEndDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      };
      const plan = { name: "basic" };
      expect(shouldShowUpgradeBanner(subscription, plan)).toBe(true);
    });

    it("should show banner for cancelled subscription", () => {
      const subscription = { status: "cancelled" };
      const plan = { name: "basic" };
      expect(shouldShowUpgradeBanner(subscription, plan)).toBe(true);
    });

    it("should show banner for past_due subscription", () => {
      const subscription = { status: "past_due" };
      const plan = { name: "premium" };
      expect(shouldShowUpgradeBanner(subscription, plan)).toBe(true);
    });

    it("should show banner when no subscription (user needs to select plan)", () => {
      // No subscription means user needs to select a plan (basic or premium)
      expect(shouldShowUpgradeBanner(null, null)).toBe(true);
      expect(shouldShowUpgradeBanner(undefined, undefined)).toBe(true);
    });
  });
});

