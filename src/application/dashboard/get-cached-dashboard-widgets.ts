/**
 * Cached dashboard widgets loader for GET /api/dashboard.
 * Uses Next.js cache with user-scoped tags so the dashboard payload is cached per user
 * and can be revalidated via revalidateTag(`dashboard-${userId}`).
 */

import { cacheLife, cacheTag } from "next/cache";
import { makeDashboardService } from "./dashboard.factory";

export async function getCachedDashboardWidgets(
  userId: string,
  selectedDate: Date
): Promise<Awaited<ReturnType<import("./dashboard.service").DashboardService["getDashboardWidgets"]>>> {
  "use cache";
  cacheTag(`dashboard-${userId}`);
  cacheLife("financial");

  let accessToken: string | undefined;
  let refreshToken: string | undefined;
  try {
    const { createServerClient } = await import("@/src/infrastructure/database/supabase-server");
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        accessToken = session.access_token;
        refreshToken = session.refresh_token;
      }
    }
  } catch {
    // Continue without tokens; service will try to get them
  }

  const service = makeDashboardService();
  return service.getDashboardWidgets(userId, selectedDate, accessToken, refreshToken);
}
