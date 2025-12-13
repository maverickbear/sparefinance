import { NextRequest, NextResponse } from "next/server";
import { makePlannedPaymentsService } from "@/src/application/planned-payments/planned-payments.factory";
import { PlannedPaymentFormData, plannedPaymentSchema } from "@/src/domain/planned-payments/planned-payments.validations";
import { PLANNED_HORIZON_DAYS } from "@/src/domain/planned-payments/planned-payments.types";
import { getCurrentUserId, guardWriteAccess, throwIfNotAllowed } from "@/src/application/shared/feature-guard";
import { AppError } from "@/src/application/shared/app-error";
import { ZodError } from "zod";


export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Parse filters from query parameters
    const filters: {
      startDate?: Date;
      endDate?: Date;
      status?: "scheduled" | "paid" | "skipped" | "cancelled";
      source?: "recurring" | "debt" | "manual" | "subscription" | "goal";
      accountId?: string;
      type?: "expense" | "income" | "transfer";
      page?: number;
      limit?: number;
    } = {};
    
    if (searchParams.get("startDate")) {
      filters.startDate = new Date(searchParams.get("startDate")!);
    }
    if (searchParams.get("endDate")) {
      filters.endDate = new Date(searchParams.get("endDate")!);
    }
    if (searchParams.get("status")) {
      filters.status = searchParams.get("status") as "scheduled" | "paid" | "skipped" | "cancelled";
    }
    if (searchParams.get("source")) {
      filters.source = searchParams.get("source") as "recurring" | "debt" | "manual" | "subscription" | "goal";
    }
    if (searchParams.get("accountId")) {
      filters.accountId = searchParams.get("accountId")!;
    }
    if (searchParams.get("type")) {
      filters.type = searchParams.get("type") as "expense" | "income" | "transfer";
    }
    
    // Parse pagination parameters
    const page = searchParams.get("page");
    const limit = searchParams.get("limit");
    if (page) {
      filters.page = parseInt(page, 10);
    }
    if (limit) {
      filters.limit = parseInt(limit, 10);
    }
    
    // Default to scheduled payments within horizon if no dates provided
    if (!filters.startDate && !filters.endDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const horizonDate = new Date(today);
      horizonDate.setDate(horizonDate.getDate() + PLANNED_HORIZON_DAYS);
      filters.startDate = today;
      filters.endDate = horizonDate;
      filters.status = filters.status || "scheduled";
    }
    
    const service = makePlannedPaymentsService();
    const result = await service.getPlannedPayments(filters);
    
    return NextResponse.json({
      plannedPayments: result.plannedPayments,
      total: result.total,
    });
  } catch (error) {
    console.error("Error fetching planned payments:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch planned payments";
    const statusCode = errorMessage.includes("Unauthorized") ? 401 : 500;
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user can perform write operations
    const writeGuard = await guardWriteAccess(userId);
    await throwIfNotAllowed(writeGuard);

    const body = await request.json();
    const data = plannedPaymentSchema.parse(body);
    
    const service = makePlannedPaymentsService();
    const plannedPayment = await service.createPlannedPayment(data);
    
    return NextResponse.json(plannedPayment, { status: 201 });
  } catch (error) {
    console.error("Error creating planned payment:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') },
        { status: 400 }
      );
    }
    
    const errorMessage = error instanceof Error ? error.message : "Failed to create planned payment";
    const statusCode = errorMessage.includes("Unauthorized") ? 401 : 400;
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

