/**
 * Dashboard Factory
 * Dependency injection for DashboardService
 */

import { DashboardService } from "./dashboard.service";

export function makeDashboardService(): DashboardService {
  return new DashboardService();
}
