import { NextRequest, NextResponse } from "next/server";
import { updateAccount, deleteAccount } from "@/lib/api/accounts";
import { AccountFormData } from "@/lib/validations/account";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data: Partial<AccountFormData> = await request.json();
    
    const account = await updateAccount(id, data);
    
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
    
    await deleteAccount(id);
    
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting account:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete account" },
      { status: 400 }
    );
  }
}

