import { NextRequest, NextResponse } from "next/server";
import { makeAccountsService } from "@/src/application/accounts/accounts.factory";
import { AccountFormData } from "@/src/domain/accounts/accounts.validations";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { requireAccountOwnership } from "@/src/infrastructure/utils/security";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // SECURITY: Verify user has access to this account
    await requireAccountOwnership(id);
    
    const supabase = await createServerClient();
    
    // Get account (RLS will ensure user can only see accounts they have access to)
    const { data: account, error: accountError } = await supabase
      .from('Account')
      .select('*')
      .eq('id', id)
      .single();

    if (accountError || !account) {
      console.error('Error fetching account:', accountError);
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Get institution name and logo from PlaidConnection if account has plaidItemId
    let institutionName: string | null = null;
    let institutionLogo: string | null = null;
    if (account.plaidItemId) {
      const { data: plaidConnection, error: plaidError } = await supabase
        .from('PlaidConnection')
        .select('institutionName, institutionLogo')
        .eq('itemId', account.plaidItemId)
        .single();

      if (!plaidError && plaidConnection) {
        institutionName = plaidConnection.institutionName || null;
        institutionLogo = plaidConnection.institutionLogo || null;
      }
    }

    return NextResponse.json({
      ...account,
      institutionName,
      institutionLogo,
    });
  } catch (error) {
    console.error("Error fetching account:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch account" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data: Partial<AccountFormData> = await request.json();
    
    const service = makeAccountsService();
    const account = await service.updateAccount(id, data);
    
    return NextResponse.json(account, { status: 200 });
  } catch (error) {
    console.error("Error updating account:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update account" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const transferToAccountId = body.transferToAccountId;
    
    const service = makeAccountsService();
    await service.deleteAccount(id, transferToAccountId);
    
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting account:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete account" },
      { status: 400 }
    );
  }
}

