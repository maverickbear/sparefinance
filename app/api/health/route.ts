/**
 * Health Check API Endpoint
 * Returns system health status for monitoring
 */

import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { performHealthCheck } from '@/lib/services/monitoring';

export async function GET() {
  noStore();
  try {
    const health = await performHealthCheck();
    
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;
    
    return NextResponse.json(health, { status: statusCode });
  } catch (error) {
    // Return safe fallback without throwing - prevents build errors
    console.error('[HealthCheck] Error performing health check:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        ok: false,
        error: 'Health check failed',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}

