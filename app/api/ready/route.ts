import { NextResponse } from "next/server";
import { HealthCheckService } from "@/src/infrastructure/health/health-check.service";

/**
 * GET /api/ready
 * Readiness probe endpoint
 * Returns 200 if all critical dependencies are available
 */
export async function GET() {
  const healthCheckService = new HealthCheckService();
  const result = await healthCheckService.checkReadiness();

  if (result.status === 'healthy') {
    return NextResponse.json(result, { status: 200 });
  }

  return NextResponse.json(result, { status: 503 });
}

