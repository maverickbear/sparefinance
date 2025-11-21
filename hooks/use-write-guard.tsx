"use client";

import { useSubscriptionContext } from "@/contexts/subscription-context";

/**
 * Hook to check if user can perform write operations
 * Users with cancelled subscriptions can still view the app but cannot write
 */
export function useWriteGuard() {
  const { subscription } = useSubscriptionContext();

  // User can write if subscription is active or trialing
  const canWrite = subscription?.status === "active" || subscription?.status === "trialing";

  const checkWriteAccess = (): boolean => {
    // Don't redirect - just return false so UI can show appropriate message
    return canWrite;
  };

  return {
    canWrite,
    checkWriteAccess,
  };
}

