import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { getCurrentUserId } from "@/lib/api/feature-guard";
import {
  getQuestradeQuotes,
  decryptTokens,
  refreshAccessToken,
  encryptTokens,
} from "@/lib/api/questrade";

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const symbolIds = searchParams.get("symbolIds");

    if (!symbolIds) {
      return NextResponse.json(
        { error: "symbolIds is required (comma-separated)" },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // Get Questrade connection
    const { data: connection, error: connectionError } = await supabase
      .from("QuestradeConnection")
      .select("*")
      .eq("userId", userId)
      .maybeSingle();

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: "Questrade connection not found" },
        { status: 404 }
      );
    }

    // Decrypt and refresh tokens if needed
    let accessToken: string;
    let refreshToken: string;

    try {
      const decrypted = decryptTokens(
        connection.accessToken,
        connection.refreshToken
      );
      accessToken = decrypted.accessToken;
      refreshToken = decrypted.refreshToken;
    } catch (decryptError: any) {
      console.error("Error decrypting tokens:", decryptError);
      return NextResponse.json(
        { error: "Failed to decrypt tokens. Please reconnect your account." },
        { status: 500 }
      );
    }

    // Check if token is expired or about to expire (within 5 minutes)
    const expiresAt = new Date(connection.tokenExpiresAt);
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    if (expiresAt <= fiveMinutesFromNow) {
      try {
        const refreshed = await refreshAccessToken(refreshToken);
        accessToken = refreshed.access_token;

        // Update connection with new tokens
        const { encryptedAccessToken, encryptedRefreshToken } = encryptTokens(
          refreshed.access_token,
          refreshed.refresh_token
        );
        const newExpiresAt = new Date(
          now.getTime() + refreshed.expires_in * 1000
        );

        await supabase
          .from("QuestradeConnection")
          .update({
            accessToken: encryptedAccessToken,
            refreshToken: encryptedRefreshToken,
            tokenExpiresAt: newExpiresAt.toISOString(),
          })
          .eq("id", connection.id);
      } catch (refreshError: any) {
        console.error("Error refreshing token:", refreshError);
        return NextResponse.json(
          { error: "Failed to refresh access token. Please reconnect." },
          { status: 500 }
        );
      }
    }

    // Parse symbol IDs
    const symbolIdArray = symbolIds.split(",").map((id) => parseInt(id.trim()));

    // Get quotes from Questrade API
    const quotesResponse = await getQuestradeQuotes(
      connection.apiServerUrl,
      accessToken,
      symbolIdArray
    );

    return NextResponse.json({ quotes: quotesResponse.quotes || [] });
  } catch (error: any) {
    console.error("Error fetching quotes:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch quotes" },
      { status: 500 }
    );
  }
}

