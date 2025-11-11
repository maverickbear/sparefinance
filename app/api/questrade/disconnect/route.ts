import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { getCurrentUserId, guardFeatureAccess, throwIfNotAllowed } from "@/lib/api/feature-guard";

export async function POST(req: NextRequest) {
  try {
    // Get current user
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has access to investments
    const guardResult = await guardFeatureAccess(userId, "hasInvestments");
    await throwIfNotAllowed(guardResult);

    const supabase = await createServerClient();

    // Get Questrade connection
    const { data: connection, error: connectionError } = await supabase
      .from("QuestradeConnection")
      .select("id")
      .eq("userId", userId)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: "Questrade connection not found" },
        { status: 404 }
      );
    }

    // Update all connected accounts to disconnect them
    await supabase
      .from("InvestmentAccount")
      .update({
        isQuestradeConnected: false,
        questradeConnectionId: null,
        updatedAt: new Date().toISOString(),
      })
      .eq("questradeConnectionId", connection.id);

    // Delete connection
    await supabase.from("QuestradeConnection").delete().eq("id", connection.id);

    return NextResponse.json({
      success: true,
      message: "Questrade account disconnected successfully",
    });
  } catch (error: any) {
    console.error("Error disconnecting Questrade account:", error);

    // Check if it's a plan error
    if (error.planError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          planError: error.planError,
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to disconnect Questrade account" },
      { status: 500 }
    );
  }
}

