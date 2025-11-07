import { NextRequest, NextResponse } from "next/server";
import { createTransaction } from "@/lib/api/transactions";
import { TransactionFormData } from "@/lib/validations/transaction";
import { ZodError } from "zod";

export async function POST(request: NextRequest) {
  try {
    const data: TransactionFormData = await request.json();
    
    const transaction = await createTransaction(data);
    
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

