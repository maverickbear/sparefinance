import { NextRequest, NextResponse } from "next/server";
import { makeAccountsService } from "@/src/application/accounts/accounts.factory";
import { AccountFormData } from "@/src/domain/accounts/accounts.validations";
import { ZodError } from "zod";
import { getCurrentUserId, guardAccountLimit, throwIfNotAllowed } from "@/src/application/shared/feature-guard";
import { AppError } from "@/src/application/shared/app-error";
import { getCacheHeaders } from "@/src/infrastructure/utils/cache-headers";
import { revalidateTag } from 'next/cache';


export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const includeHoldings = searchParams.get("includeHoldings") !== "false"; // Default to true for backward compatibility
    
    const service = makeAccountsService();
    const accounts = await service.getAccounts(undefined, undefined, { includeHoldings });
    
    // Enrich accounts with Plaid status information
    const accountsWithPlaidStatus = await Promise.all(
      accounts.map(async (account) => {
        // Only fetch Plaid status for connected accounts
        // plaidItemId may exist on the account even if not in the type definition
        const plaidItemId = (account as any).plaidItemId;
        if (!account.isConnected || !plaidItemId) {
          return account;
        }

        try {
          // Get Plaid item status
          const { PlaidItemsRepository } = await import("@/src/infrastructure/database/repositories/plaid-items.repository");
          const plaidItemsRepository = new PlaidItemsRepository();
          const item = await plaidItemsRepository.findByItemId(plaidItemId);

          if (item && item.user_id === userId) {
            return {
              ...account,
              plaidStatus: item.status,
              plaidErrorCode: item.error_code,
              plaidErrorMessage: item.error_message,
              plaidIsSyncing: item.is_syncing,
            };
          }
        } catch (error) {
          // Silently fail - don't break the accounts list if Plaid status fetch fails
          console.error(`Error fetching Plaid status for account ${account.id}:`, error);
        }

        return account;
      })
    );
    
    // Account list changes occasionally, use semi-static cache
    const cacheHeaders = getCacheHeaders('semi-static');
    
    return NextResponse.json(accountsWithPlaidStatus, { 
      status: 200,
      headers: cacheHeaders,
    });
  } catch (error) {
    console.error("Error fetching accounts:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
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
    
    const service = makeAccountsService();
    const account = await service.createAccount(data);
    
    // Invalidate cache using tag groups (invalidates all account variants)
    revalidateTag('accounts', 'max');
    revalidateTag('subscriptions', 'max');
    
    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    console.error("Error creating account:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
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

