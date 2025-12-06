/**
 * Tax Rates API Routes
 * GET: List all tax rates
 * POST: Create a new tax rate
 */

import { NextRequest, NextResponse } from "next/server";
import { makeTaxRatesService } from "@/src/application/taxes/tax-rates.factory";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { makeAdminService } from "@/src/application/admin/admin.factory";
import { AppError } from "@/src/application/shared/app-error";
import { getCacheHeaders } from "@/src/infrastructure/utils/cache-headers";
import { revalidateTag } from 'next/cache';

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is super_admin
    const adminService = makeAdminService();
    if (!(await adminService.isSuperAdmin(userId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const service = makeTaxRatesService();
    const rates = await service.getAll();

    // Tax rates change annually, so use static cache with longer TTL
    const cacheHeaders = getCacheHeaders('static');
    // Override with longer cache for tax rates (24h instead of 1h)
    cacheHeaders['Cache-Control'] = 'public, s-maxage=86400, stale-while-revalidate=172800';

    return NextResponse.json(rates, {
      status: 200,
      headers: cacheHeaders,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is super_admin
    const adminService = makeAdminService();
    if (!(await adminService.isSuperAdmin(userId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const service = makeTaxRatesService();
    const rate = await service.create(body);

    // Invalidate cache
    revalidateTag('tax-rates', 'max');

    return NextResponse.json(rate, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

