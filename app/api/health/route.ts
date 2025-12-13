import { NextResponse } from "next/server";
import { HealthCheckService } from "@/src/infrastructure/health/health-check.service";

/**
 * GET /api/health
 * Liveness probe endpoint
 * Returns 200 if the application is running
 */
export async function GET() {
  const healthCheckService = new HealthCheckService();
  const isAlive = await healthCheckService.checkLiveness();

  if (isAlive) {
    return NextResponse.json(
      { status: "healthy", timestamp: new Date().toISOString() },
      { status: 200 }
    );
  }

  return NextResponse.json(
    { status: "unhealthy", timestamp: new Date().toISOString() },
    { status: 503 }
  );
}
