import { NextRequest, NextResponse } from "next/server";
import { createTransaction, getTransactions } from "@/lib/api/transactions";
import { TransactionFormData, transactionSchema } from "@/lib/validations/transaction";
import { ZodError } from "zod";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Parse filters from query parameters
    const filters: {
      startDate?: Date;
      endDate?: Date;
      categoryId?: string;
      accountId?: string;
      type?: string;
      search?: string;
      recurring?: boolean;
      page?: number;
      limit?: number;
    } = {};
    
    if (searchParams.get("startDate")) {
      filters.startDate = new Date(searchParams.get("startDate")!);
    }
    if (searchParams.get("endDate")) {
      filters.endDate = new Date(searchParams.get("endDate")!);
    } else {
      // Por padrão, mostrar apenas transações até a data atual
      // Isso evita mostrar transações futuras
      const today = new Date();
      today.setHours(23, 59, 59, 999); // Fim do dia atual
      filters.endDate = today;
    }
    if (searchParams.get("categoryId")) {
      filters.categoryId = searchParams.get("categoryId")!;
    }
    if (searchParams.get("accountId")) {
      filters.accountId = searchParams.get("accountId")!;
    }
    if (searchParams.get("type")) {
      filters.type = searchParams.get("type")!;
    }
    if (searchParams.get("search")) {
      filters.search = searchParams.get("search")!;
    }
    if (searchParams.get("recurring")) {
      filters.recurring = searchParams.get("recurring") === "true";
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
    
    const result = await getTransactions(filters);
    
    // Use appropriate cache headers based on whether search is active
    // Search results should not be cached, but regular queries can be cached briefly
    // Note: Cache is invalidated server-side via revalidateTag, but we also set shorter browser cache
    // to ensure UI updates quickly after deletions
    const hasSearch = !!filters.search;
    const cacheHeaders = hasSearch
      ? {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        }
      : {
          'Cache-Control': 'private, max-age=0, must-revalidate', // Changed from max-age=10 to 0 to force revalidation
        };
    
    return NextResponse.json(result, { 
      status: 200,
      headers: cacheHeaders,
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch transactions" },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Date is now sent as YYYY-MM-DD string from frontend to avoid timezone issues
    // Convert to Date object for validation (formatDateOnly will convert back to YYYY-MM-DD)
    const data: TransactionFormData = {
      ...body,
      // If it's already a Date, use it; otherwise parse the YYYY-MM-DD string
      // Note: body.date should be YYYY-MM-DD string, not ISO timestamp
      date: body.date instanceof Date ? body.date : new Date(body.date + 'T00:00:00'),
    };
    
    // Validate with schema
    const validatedData = transactionSchema.parse(data);
    
    const transaction = await createTransaction(validatedData);
    
    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error("Error creating transaction:", error);
    
    // Handle validation errors
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') },
        { status: 400 }
      );
    }
    
    // Handle other errors
    const errorMessage = error instanceof Error ? error.message : "Failed to create transaction";
    const statusCode = errorMessage.includes("Unauthorized") ? 401 : 400;
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

