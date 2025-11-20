import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-server";

/**
 * POST /api/auth/create-household-member
 * Creates personal household and member record using service role (bypasses RLS)
 * This is called when RLS prevents direct insertion during signup
 * NOTE: This endpoint is now deprecated in favor of automatic household creation in signup/signin
 * Keeping for backward compatibility
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

    // Check if personal household already exists
    const { data: existingHousehold } = await serviceRoleClient
      .from("Household")
      .select("id")
      .eq("createdBy", ownerId)
      .eq("type", "personal")
      .maybeSingle();

    if (existingHousehold) {
      // Check if member already exists
      const { data: existingMember } = await serviceRoleClient
        .from("HouseholdMemberNew")
        .select("id")
        .eq("householdId", existingHousehold.id)
        .eq("userId", memberId || ownerId)
      .maybeSingle();

    if (existingMember) {
      return NextResponse.json({ 
        success: true,
        message: "Household member already exists"
      });
      }
    }

    const now = new Date().toISOString();
    let householdId = existingHousehold?.id;

    // Create personal household if it doesn't exist
    if (!householdId) {
      const { data: household, error: householdError } = await serviceRoleClient
        .from("Household")
        .insert({
          name: name || email || "Minha Conta",
          type: "personal",
          createdBy: ownerId,
          createdAt: now,
          updatedAt: now,
          settings: {},
        })
        .select()
        .single();

      if (householdError || !household) {
        console.error("[CREATE-HOUSEHOLD-MEMBER] Error creating household:", householdError);
        return NextResponse.json(
          { error: "Failed to create household", details: householdError?.message },
          { status: 500 }
        );
      }

      householdId = household.id;
    }

    // Create household member using service role (bypasses RLS)
    const { error: memberError } = await serviceRoleClient
      .from("HouseholdMemberNew")
      .insert({
        householdId: householdId,
        userId: memberId || ownerId,
        role: "owner", // Owner is owner role
        status: "active", // Owner is immediately active
        isDefault: true, // Personal household is default
        joinedAt: now,
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

    // Set as active household if not already set
    await serviceRoleClient
      .from("UserActiveHousehold")
      .upsert({
        userId: memberId || ownerId,
        householdId: householdId,
        updatedAt: now,
      }, {
        onConflict: "userId"
      });

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

