"use client";

import { useRouter } from "next/navigation";
import { useSubscriptionContext } from "@/contexts/subscription-context";

/**
 * Hook to check if user can perform write operations
 * Redirects to pricing page if subscription is cancelled or inactive
 */
export function useWriteGuard() {
  const { subscription } = useSubscriptionContext();
  const router = useRouter();

  // User can write if subscription is active or trialing
  const canWrite = subscription?.status === "active" || subscription?.status === "trialing";

  const checkWriteAccess = (): boolean => {
    if (!canWrite) {
      // Redirect to pricing page if subscription is cancelled or inactive
      router.push("/pricing");
      return false;
    }
    return true;
  };

  return {
    canWrite,
    checkWriteAccess,
  };
}

