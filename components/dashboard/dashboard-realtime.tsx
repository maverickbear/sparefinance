"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { revalidateDashboard } from "@/lib/actions/revalidate";

/**
 * Component that sets up real-time subscriptions for dashboard data
 * Automatically refreshes the dashboard when transactions, budgets, goals, or accounts change
 */
export function DashboardRealtime() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Only set up subscriptions on dashboard page
    if (pathname !== "/dashboard") {
      return;
    }

    // Debounce refresh calls to avoid too many refreshes
    let refreshTimeout: NodeJS.Timeout | null = null;
    const scheduleRefresh = async () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
      refreshTimeout = setTimeout(async () => {
        // Only refresh the router - cache invalidation is handled by revalidateTag in API functions
        // This avoids invalidating cache on initial page load
        router.refresh();
      }, 500); // Debounce for 500ms
    };

    // Set up subscriptions for all relevant tables
    const subscriptions = [
      // Transactions subscription
      supabase
        .channel("dashboard-transactions")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "Transaction",
          },
          () => {
            scheduleRefresh();
          }
        )
        .subscribe(),

      // Budgets subscription
      supabase
        .channel("dashboard-budgets")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "Budget",
          },
          () => {
            scheduleRefresh();
          }
        )
        .subscribe(),

      // Goals subscription
      supabase
        .channel("dashboard-goals")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "Goal",
          },
          () => {
            scheduleRefresh();
          }
        )
        .subscribe(),

      // Accounts subscription
      supabase
        .channel("dashboard-accounts")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "Account",
          },
          () => {
            scheduleRefresh();
          }
        )
        .subscribe(),
    ];

    // Cleanup subscriptions on unmount
    return () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
      subscriptions.forEach((subscription) => {
        supabase.removeChannel(subscription);
      });
    };
  }, [router, pathname]);

  // This component doesn't render anything
  return null;
}

