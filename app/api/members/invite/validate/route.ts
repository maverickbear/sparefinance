import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Invitation token is required" },
        { status: 400 }
      );
    }

    // Use regular client - the PostgreSQL function will handle security
    // This is more secure than using service role client
    const supabase = await createServerClient();

    console.log("[INVITE-VALIDATE] Validating token:", token.substring(0, 8) + "...");

    // Use secure PostgreSQL function to validate invitation token
    // This function only returns limited data and can be called without authentication
    const { data: invitationData, error: findError } = await supabase
      .rpc("validate_invitation_token", { p_token: token });

    if (findError) {
      console.error("[INVITE-VALIDATE] Error validating invitation:", {
        error: findError,
        code: findError.code,
        message: findError.message,
      });
      
      return NextResponse.json(
        { error: "Invalid or expired invitation token" },
        { status: 404 }
      );
    }

    if (!invitationData || invitationData.length === 0) {
      console.warn("[INVITE-VALIDATE] No invitation found for token");
      return NextResponse.json(
        { error: "Invalid or expired invitation token" },
        { status: 404 }
      );
    }

    const invitation = invitationData[0];

    console.log("[INVITE-VALIDATE] Invitation found:", {
      id: invitation.id,
      email: invitation.email,
      status: invitation.status,
    });

    // Get owner information using secure function
    const { data: ownerData, error: ownerError } = await supabase
      .rpc("get_owner_info_for_invitation", { p_owner_id: invitation.owner_id });

    if (ownerError) {
      console.error("[INVITE-VALIDATE] Error fetching owner:", ownerError);
    }

    const owner = ownerData && ownerData.length > 0 ? ownerData[0] : null;

    // Check if email already has an account using secure function
    const { data: hasAccountData, error: userCheckError } = await supabase
      .rpc("check_email_has_account", { p_email: invitation.email });

    if (userCheckError) {
      console.error("[INVITE-VALIDATE] Error checking existing user:", userCheckError);
    }

    const hasAccount = hasAccountData === true;

    return NextResponse.json({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        name: invitation.name,
        role: invitation.role,
      },
      owner: owner ? {
        name: owner.name || owner.email,
        email: owner.email,
      } : null,
      hasAccount: hasAccount, // Indicates if email already has an account
    });
  } catch (error) {
    console.error("Error validating invitation:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to validate invitation";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

