import { NextRequest, NextResponse } from "next/server";
import { createAccount, getAccounts } from "@/lib/api/accounts";
import { AccountFormData } from "@/lib/validations/account";
import { ZodError } from "zod";
import { getCurrentUserId, guardAccountLimit, throwIfNotAllowed } from "@/lib/api/feature-guard";

export async function GET(request: NextRequest) {
  try {
    const accounts = await getAccounts();
    return NextResponse.json(accounts, { status: 200 });
  } catch (error) {
    console.error("Error fetching accounts:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch accounts" },
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

    // Check account limit (this also verifies write access)
    const accountGuard = await guardAccountLimit(userId);
    await throwIfNotAllowed(accountGuard);

    const data: AccountFormData = await request.json();
    
    const account = await createAccount(data);
    
    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    console.error("Error creating account:", error);
    
    // Handle validation errors
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') },
        { status: 400 }
      );
    }
    
    // Handle other errors
    const errorMessage = error instanceof Error ? error.message : "Failed to create account";
    const statusCode = errorMessage.includes("Unauthorized") ? 401 : 400;
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

