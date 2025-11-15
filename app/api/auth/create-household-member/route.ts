import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-server";

/**
 * POST /api/auth/create-household-member
 * Creates household member record using service role (bypasses RLS)
 * This is called when RLS prevents direct insertion during signup
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ownerId, memberId, email, name } = body;

    if (!ownerId || !email) {
      return NextResponse.json(
        { error: "ownerId and email are required" },
        { status: 400 }
      );
    }

    // Use service role client to bypass RLS
    const serviceRoleClient = createServiceRoleClient();

    // Check if household member already exists
    const { data: existingMember } = await serviceRoleClient
      .from("HouseholdMember")
      .select("id")
      .eq("ownerId", ownerId)
      .eq("memberId", memberId || ownerId)
      .maybeSingle();

    if (existingMember) {
      return NextResponse.json({ 
        success: true,
        message: "Household member already exists"
      });
    }

    const invitationToken = crypto.randomUUID();
    const now = new Date().toISOString();

    // Create household member using service role (bypasses RLS)
    const { error: memberError } = await serviceRoleClient
      .from("HouseholdMember")
      .insert({
        ownerId: ownerId,
        memberId: memberId || ownerId,
        email: email,
        name: name || null,
        role: "admin", // Owner is admin
        status: "active", // Owner is immediately active
        invitationToken: invitationToken,
        invitedAt: now,
        acceptedAt: now, // Owner accepts immediately
        createdAt: now,
        updatedAt: now,
      });

    if (memberError) {
      console.error("[CREATE-HOUSEHOLD-MEMBER] Error creating household member:", {
        message: memberError.message,
        details: memberError.details,
        hint: memberError.hint,
        code: memberError.code,
        ownerId,
        memberId,
        email,
      });

      // If it's a duplicate key error, that's OK - member already exists
      if (memberError.code === "23505" || 
          memberError.message?.includes("duplicate") || 
          memberError.message?.includes("unique")) {
        return NextResponse.json({ 
          success: true,
          message: "Household member already exists (duplicate key)"
        });
      }

      return NextResponse.json(
        { error: "Failed to create household member", details: memberError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: "Household member created successfully"
    });
  } catch (error) {
    console.error("[CREATE-HOUSEHOLD-MEMBER] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

