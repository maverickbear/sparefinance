import { NextRequest, NextResponse } from "next/server";
import { makeAuthService } from "@/src/application/auth/auth.factory";
import { signUpSchema } from "@/src/domain/auth/auth.validations";
import { ZodError } from "zod";
import { verifyTurnstileToken, getClientIp } from "@/src/infrastructure/utils/turnstile";
import { metrics } from "@/src/infrastructure/monitoring/metrics.service";
import { getMetricsService } from "@/src/infrastructure/monitoring/metrics.service";

/**
 * POST /api/v2/auth/signup
 * Sign up a new user
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const timer = getMetricsService().timer('signup');
  
  try {
    const body = await request.json();
    
    // Validate input
    const validated = signUpSchema.parse(body);
    
    // Validate Turnstile token
    const clientIp = getClientIp(request);
    const turnstileValidation = await verifyTurnstileToken(validated.turnstileToken, clientIp);
    if (!turnstileValidation.success) {
      const duration = Date.now() - startTime;
      metrics.trackApiRequest('/api/v2/auth/signup', 'POST', duration, 400);
      metrics.trackAuthEvent('signup', false);
      return NextResponse.json(
        { error: turnstileValidation.error || "Security verification failed" },
        { status: 400 }
      );
    }
    
    const service = makeAuthService();
    const result = await service.signUp(validated);
    
    const duration = Date.now() - startTime;
    timer();
    
    if (result.error) {
      metrics.trackApiRequest('/api/v2/auth/signup', 'POST', duration, 400);
      metrics.trackAuthEvent('signup', false);
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }
    
    metrics.trackApiRequest('/api/v2/auth/signup', 'POST', duration, 201);
    metrics.trackAuthEvent('signup', true);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const duration = Date.now() - startTime;
    metrics.trackApiRequest('/api/v2/auth/signup', 'POST', duration, 500);
    metrics.trackAuthEvent('signup', false);
    console.error("Error in signup:", error);
    
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sign up" },
      { status: 500 }
    );
  }
}

