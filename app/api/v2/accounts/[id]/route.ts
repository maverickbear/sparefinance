import { NextRequest, NextResponse } from "next/server";
import { makeAccountsService } from "@/src/application/accounts/accounts.factory";
import { AccountFormData } from "@/src/domain/accounts/accounts.validations";
import { AppError } from "@/src/application/shared/app-error";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { requireAccountOwnership } from "@/src/infrastructure/utils/security";
import { revalidateTag } from 'next/cache';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    
    // Verify account ownership
    await requireAccountOwnership(id);
    
    const service = makeAccountsService();
    const account = await service.getAccountById(id);
    
    return NextResponse.json(account);
  } catch (error) {
    console.error("Error fetching account:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
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
    
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Verify account ownership
    await requireAccountOwnership(id);
    
    const service = makeAccountsService();
    const account = await service.updateAccount(id, data);
    
    // Invalidate cache so dashboard and reports reflect changes
    revalidateTag('accounts', 'max');
    revalidateTag('subscriptions', 'max');
    revalidateTag(`dashboard-${userId}`, 'max');
    revalidateTag(`reports-${userId}`, 'max');
    
    return NextResponse.json(account, { status: 200 });
  } catch (error) {
    console.error("Error updating account:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
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
    
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Verify account ownership
    await requireAccountOwnership(id);
    
    const service = makeAccountsService();
    await service.deleteAccount(id, transferToAccountId);
    
    // Invalidate cache so dashboard and reports reflect changes
    revalidateTag('accounts', 'max');
    revalidateTag('subscriptions', 'max');
    revalidateTag(`dashboard-${userId}`, 'max');
    revalidateTag(`reports-${userId}`, 'max');
    
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting account:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete account" },
      { status: 400 }
    );
  }
}

