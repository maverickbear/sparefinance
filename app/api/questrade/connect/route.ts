import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { exchangeAuthToken, encryptTokens } from "@/lib/api/questrade";
import { syncQuestradeAccounts, syncQuestradeBalances, syncQuestradeHoldings, syncQuestradeTransactions } from "@/lib/api/questrade/sync";
import { getCurrentUserId, guardFeatureAccess, throwIfNotAllowed } from "@/lib/api/feature-guard";
import { formatTimestamp } from "@/lib/utils/timestamp";
import crypto from "crypto";

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

    // Parse request body
    const body = await req.json();
    const { manualAuthToken } = body;

    if (!manualAuthToken) {
      return NextResponse.json(
        { error: "Missing manualAuthToken" },
        { status: 400 }
      );
    }

    // Exchange manual auth token for access/refresh tokens
    const tokenResponse = await exchangeAuthToken(manualAuthToken);

    // Validate API server URL
    if (!tokenResponse.api_server) {
      throw new Error("Invalid API server URL received from Questrade");
    }

    console.log(`[Questrade Connect] API Server URL: ${tokenResponse.api_server}`);
    console.log(`[Questrade Connect] Access token expires in: ${tokenResponse.expires_in} seconds`);

    // Encrypt tokens
    const { encryptedAccessToken, encryptedRefreshToken } = encryptTokens(
      tokenResponse.access_token,
      tokenResponse.refresh_token
    );

    // Calculate token expiration
    const now = new Date();
    const tokenExpiresAt = new Date(
      now.getTime() + tokenResponse.expires_in * 1000
    );

    const supabase = await createServerClient();

    // Check if connection already exists for this user
    const { data: existingConnection } = await supabase
      .from("QuestradeConnection")
      .select("id")
      .eq("userId", userId)
      .single();

    const connectionId = existingConnection?.id || crypto.randomUUID();
    const nowTimestamp = formatTimestamp(now);

    if (existingConnection) {
      // Update existing connection
      await supabase
        .from("QuestradeConnection")
        .update({
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          apiServerUrl: tokenResponse.api_server,
          tokenExpiresAt: formatTimestamp(tokenExpiresAt),
          updatedAt: nowTimestamp,
        })
        .eq("id", connectionId);
    } else {
      // Create new connection
      await supabase.from("QuestradeConnection").insert({
        id: connectionId,
        userId,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        apiServerUrl: tokenResponse.api_server,
        tokenExpiresAt: formatTimestamp(tokenExpiresAt),
        createdAt: nowTimestamp,
        updatedAt: nowTimestamp,
      });
    }

    // Sync accounts, balances, holdings, and transactions
    try {
      await syncQuestradeAccounts(connectionId, userId);
      await syncQuestradeBalances(connectionId, userId);
      await syncQuestradeHoldings(connectionId, userId);
      
      // Sync transactions from last 90 days
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 90 * 24 * 60 * 60 * 1000);
      await syncQuestradeTransactions(
        connectionId,
        userId,
        undefined,
        startTime.toISOString(),
        endTime.toISOString()
      );
    } catch (syncError: any) {
      console.error("Error syncing Questrade data:", syncError);
      // Don't fail the connection if sync fails
    }

    return NextResponse.json({
      success: true,
      connectionId,
      message: "Questrade account connected successfully",
    });
  } catch (error: any) {
    console.error("Error connecting Questrade account:", error);

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
      { error: error.message || "Failed to connect Questrade account" },
      { status: 500 }
    );
  }
}

