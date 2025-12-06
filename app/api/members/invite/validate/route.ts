import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { makeMembersService } from "@/src/application/members/members.factory";
import { AppError } from "@/src/application/shared/app-error";

export async function GET(request: Request) {
  // Opt out of static generation - this route uses request.url
  noStore();
  
  try {
    // Use request.url for Request type (not NextRequest)
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const token = searchParams.get("token");

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Invitation token is required" },
        { status: 400 }
      );
    }

    const service = makeMembersService();
    
    console.log("[INVITE-VALIDATE] Validating token:", token.substring(0, 8) + "...");

    // Use service to validate invitation token
    const invitation = await service.validateInvitationToken(token);

    if (!invitation) {
      console.warn("[INVITE-VALIDATE] No invitation found for token");
      throw new AppError("Invalid or expired invitation token", 404);
    }

    console.log("[INVITE-VALIDATE] Invitation found:", {
      id: invitation.id,
      email: invitation.email,
    });

    // Get owner information and check if email has account using service
    const [owner, hasAccount] = await Promise.all([
      service.getOwnerInfoForInvitation(invitation.owner_id),
      service.checkEmailHasAccount(invitation.email),
    ]);

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
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    const errorMessage = error instanceof Error ? error.message : "Failed to validate invitation";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

