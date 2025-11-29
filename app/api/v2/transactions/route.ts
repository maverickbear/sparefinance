import { NextRequest, NextResponse } from "next/server";
import { makeTransactionsService } from "@/src/application/transactions/transactions.factory";
import { TransactionFormData, transactionSchema } from "@/src/domain/transactions/transactions.validations";
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
      type?: 'income' | 'expense' | 'transfer';
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
    }
    if (searchParams.get("categoryId")) {
      filters.categoryId = searchParams.get("categoryId")!;
    }
    if (searchParams.get("accountId")) {
      filters.accountId = searchParams.get("accountId")!;
    }
    if (searchParams.get("type")) {
      filters.type = searchParams.get("type")! as 'income' | 'expense' | 'transfer';
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
    
    const service = makeTransactionsService();
    const result = await service.getTransactions(filters);
    
    // Use appropriate cache headers
    const hasSearch = !!filters.search;
    const cacheHeaders = hasSearch
      ? {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        }
      : {
          'Cache-Control': 'private, max-age=0, must-revalidate',
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
    // Convert to Date object for validation
    const data: TransactionFormData = {
      ...body,
      date: body.date instanceof Date ? body.date : new Date(body.date + 'T00:00:00'),
    };
    
    // Validate with schema
    const validatedData = transactionSchema.parse(data);
    
    const service = makeTransactionsService();
    const transaction = await service.createTransaction(validatedData);
    
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

