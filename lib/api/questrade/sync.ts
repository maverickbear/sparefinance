/**
 * Questrade Sync Functions
 * Maps Questrade API data to system format and syncs to database
 */

"use server";

import { createServerClient } from "@/lib/supabase-server";
import {
  getQuestradeAccounts,
  getQuestradePositions,
  getQuestradeBalances,
  getQuestradeActivities,
  getQuestradeQuotes,
  getQuestradeOrders,
  getQuestradeExecutions,
  getQuestradeCandles,
  searchQuestradeSymbols,
  decryptTokens,
  refreshAccessToken,
  encryptTokens,
  type QuestradeAccount,
  type QuestradePosition,
  type QuestradeActivity,
  type QuestradeQuote,
} from "./index";
import { formatTimestamp } from "@/lib/utils/timestamp";
import { mapClassToSector } from "@/lib/utils/portfolio-utils";
import crypto from "crypto";

/**
 * Get and refresh Questrade connection tokens if needed
 */
async function getQuestradeConnection(
  connectionId: string,
  userId: string
): Promise<{
  accessToken: string;
  refreshToken: string;
  apiServerUrl: string;
  tokenExpiresAt: Date;
}> {
  const supabase = await createServerClient();

  // Get connection
  const { data: connection, error } = await supabase
    .from("QuestradeConnection")
    .select("*")
    .eq("id", connectionId)
    .eq("userId", userId)
    .single();

  if (error || !connection) {
    throw new Error("Questrade connection not found");
  }

  // Decrypt tokens
  let accessToken: string;
  let refreshToken: string;
  
  try {
    const decrypted = decryptTokens(
      connection.accessToken,
      connection.refreshToken
    );
    accessToken = decrypted.accessToken;
    refreshToken = decrypted.refreshToken;
    console.log(`[Questrade Sync] Tokens decrypted successfully. Access token length: ${accessToken.length}`);
  } catch (decryptError: any) {
    console.error(`[Questrade Sync] Error decrypting tokens:`, decryptError);
    throw new Error("Failed to decrypt Questrade tokens. Please reconnect your account.");
  }

  // Check if token is expired or about to expire (within 5 minutes)
  const expiresAt = new Date(connection.tokenExpiresAt);
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
  
  console.log(`[Questrade Sync] Token expires at: ${expiresAt.toISOString()}, Now: ${now.toISOString()}, Needs refresh: ${expiresAt <= fiveMinutesFromNow}`);

  if (expiresAt <= fiveMinutesFromNow) {
    // Refresh token
    try {
      const tokenResponse = await refreshAccessToken(refreshToken);
      const { encryptedAccessToken, encryptedRefreshToken } = encryptTokens(
        tokenResponse.access_token,
        tokenResponse.refresh_token
      );

      const newExpiresAt = new Date(
        now.getTime() + tokenResponse.expires_in * 1000
      );

      // Update connection
      await supabase
        .from("QuestradeConnection")
        .update({
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          tokenExpiresAt: formatTimestamp(newExpiresAt),
          updatedAt: formatTimestamp(now),
        })
        .eq("id", connectionId);

      return {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        apiServerUrl: tokenResponse.api_server,
        tokenExpiresAt: newExpiresAt,
      };
    } catch (error: any) {
      console.error("Error refreshing Questrade token:", error);
      throw new Error("Failed to refresh Questrade token");
    }
  }

  return {
    accessToken,
    refreshToken,
    apiServerUrl: connection.apiServerUrl,
    tokenExpiresAt: expiresAt,
  };
}

/**
 * Sync Questrade accounts to InvestmentAccount table
 */
export async function syncQuestradeAccounts(
  connectionId: string,
  userId: string
): Promise<{ synced: number; errors: number }> {
  try {
    const { accessToken, apiServerUrl } = await getQuestradeConnection(
      connectionId,
      userId
    );

    // Get accounts from Questrade
    const accountsResponse = await getQuestradeAccounts(apiServerUrl, accessToken);
    const accounts = accountsResponse.accounts;

    const supabase = await createServerClient();
    let synced = 0;
    let errors = 0;

    for (const account of accounts) {
      try {
        // Check if account already exists
        const { data: existingAccount } = await supabase
          .from("InvestmentAccount")
          .select("id")
          .eq("questradeAccountNumber", account.number)
          .eq("userId", userId)
          .single();

        const accountData = {
          name: `${account.type} - ${account.number}`,
          type: account.type,
          userId,
          questradeAccountNumber: account.number,
          questradeConnectionId: connectionId,
          isQuestradeConnected: true,
          updatedAt: formatTimestamp(new Date()),
        };

        if (existingAccount) {
          // Update existing account
          await supabase
            .from("InvestmentAccount")
            .update(accountData)
            .eq("id", existingAccount.id);
        } else {
          // Create new account
          const accountId = crypto.randomUUID();
          await supabase.from("InvestmentAccount").insert({
            id: accountId,
            ...accountData,
            createdAt: formatTimestamp(new Date()),
          });
        }

        synced++;
      } catch (error: any) {
        console.error(`Error syncing account ${account.number}:`, error);
        errors++;
      }
    }

    // Update lastSyncedAt
    await supabase
      .from("QuestradeConnection")
      .update({ lastSyncedAt: formatTimestamp(new Date()) })
      .eq("id", connectionId);

    return { synced, errors };
  } catch (error: any) {
    console.error("Error syncing Questrade accounts:", error);
    throw new Error(error.message || "Failed to sync Questrade accounts");
  }
}

/**
 * Sync Questrade balances to InvestmentAccount table
 */
export async function syncQuestradeBalances(
  connectionId: string,
  userId: string,
  accountId?: string
): Promise<{ synced: number; errors: number }> {
  try {
    const { accessToken, apiServerUrl } = await getQuestradeConnection(
      connectionId,
      userId
    );

    const supabase = await createServerClient();

    // Get all Questrade-connected accounts
    let query = supabase
      .from("InvestmentAccount")
      .select("id, questradeAccountNumber")
      .eq("questradeConnectionId", connectionId)
      .eq("isQuestradeConnected", true)
      .eq("userId", userId);

    if (accountId) {
      query = query.eq("id", accountId);
    }

    const { data: accounts, error: accountsError } = await query;

    if (accountsError || !accounts || accounts.length === 0) {
      throw new Error("No Questrade accounts found");
    }

    let synced = 0;
    let errors = 0;
    const now = new Date();

    for (const account of accounts) {
      if (!account.questradeAccountNumber) continue;

      try {
        // Get balances from Questrade
        const balancesResponse = await getQuestradeBalances(
          apiServerUrl,
          accessToken,
          account.questradeAccountNumber
        );

        // Use combined balances (aggregated across all currencies)
        // If not available, use per-currency balances (typically CAD for Canadian accounts)
        const balances = balancesResponse.combinedBalances?.[0] || 
                        balancesResponse.perCurrencyBalances?.[0];

        if (!balances) {
          console.warn(`No balances found for account ${account.questradeAccountNumber}`);
          errors++;
          continue;
        }

        // Update account with balance information
        await supabase
          .from("InvestmentAccount")
          .update({
            cash: balances.cash || 0,
            marketValue: balances.marketValue || 0,
            totalEquity: balances.totalEquity || 0,
            buyingPower: balances.buyingPower || 0,
            maintenanceExcess: balances.maintenanceExcess || 0,
            currency: balances.currency || "CAD",
            balanceLastUpdatedAt: formatTimestamp(now),
            updatedAt: formatTimestamp(now),
          })
          .eq("id", account.id);

        synced++;
      } catch (error: any) {
        console.error(
          `Error syncing balances for account ${account.questradeAccountNumber}:`,
          error
        );
        errors++;
      }
    }

    return { synced, errors };
  } catch (error: any) {
    console.error("Error syncing Questrade balances:", error);
    throw new Error(error.message || "Failed to sync Questrade balances");
  }
}

/**
 * Sync Questrade positions (holdings) to InvestmentTransaction and Security tables
 */
export async function syncQuestradeHoldings(
  connectionId: string,
  userId: string,
  accountId?: string
): Promise<{ synced: number; errors: number }> {
  try {
    const { accessToken, apiServerUrl } = await getQuestradeConnection(
      connectionId,
      userId
    );

    const supabase = await createServerClient();

    // Get all Questrade-connected accounts
    let query = supabase
      .from("InvestmentAccount")
      .select("id, questradeAccountNumber")
      .eq("questradeConnectionId", connectionId)
      .eq("isQuestradeConnected", true)
      .eq("userId", userId);

    if (accountId) {
      query = query.eq("id", accountId);
    }

    const { data: accounts, error: accountsError } = await query;

    if (accountsError || !accounts || accounts.length === 0) {
      throw new Error("No Questrade accounts found");
    }

    let synced = 0;
    let errors = 0;

    // Get quotes for all symbols
    const allSymbolIds: number[] = [];

    for (const account of accounts) {
      if (!account.questradeAccountNumber) continue;

      try {
        // Get positions from Questrade
        const positionsResponse = await getQuestradePositions(
          apiServerUrl,
          accessToken,
          account.questradeAccountNumber
        );

        const positions = positionsResponse.positions;

        for (const position of positions) {
          if (position.symbolId && !allSymbolIds.includes(position.symbolId)) {
            allSymbolIds.push(position.symbolId);
          }
        }
      } catch (error: any) {
        console.error(
          `Error fetching positions for account ${account.questradeAccountNumber}:`,
          error
        );
        errors++;
      }
    }

    // Get quotes for all symbols
    let quotesMap = new Map<number, QuestradeQuote>();
    if (allSymbolIds.length > 0) {
      try {
        // Questrade API limits quotes to 50 at a time
        for (let i = 0; i < allSymbolIds.length; i += 50) {
          const batch = allSymbolIds.slice(i, i + 50);
          const quotesResponse = await getQuestradeQuotes(
            apiServerUrl,
            accessToken,
            batch
          );
          for (const quote of quotesResponse.quotes) {
            quotesMap.set(quote.symbolId, quote);
          }
        }
      } catch (error: any) {
        console.error("Error fetching quotes:", error);
        // Continue without quotes
      }
    }

    // Process positions
    for (const account of accounts) {
      if (!account.questradeAccountNumber) continue;

      try {
        const positionsResponse = await getQuestradePositions(
          apiServerUrl,
          accessToken,
          account.questradeAccountNumber
        );

        const positions = positionsResponse.positions;

        for (const position of positions) {
          if (position.openQuantity === 0) continue; // Skip closed positions

          try {
            // Find or create Security
            let securityId: string;

            const { data: existingSecurity } = await supabase
              .from("Security")
              .select("id")
              .eq("symbol", position.symbol)
              .single();

            if (existingSecurity) {
              securityId = existingSecurity.id;
            } else {
              // Create new Security
              securityId = crypto.randomUUID();
              const quote = quotesMap.get(position.symbolId);
              const sector = mapClassToSector("Stock", position.symbol);

              await supabase.from("Security").insert({
                id: securityId,
                symbol: position.symbol,
                name: position.symbol, // Questrade doesn't provide name in positions
                class: "Stock", // Default, can be improved
                sector,
                createdAt: formatTimestamp(new Date()),
                updatedAt: formatTimestamp(new Date()),
              });

              // Add price if available
              if (quote && quote.lastTradePrice) {
                await supabase.from("SecurityPrice").insert({
                  id: crypto.randomUUID(),
                  securityId,
                  price: quote.lastTradePrice,
                  date: formatTimestamp(new Date()),
                  createdAt: formatTimestamp(new Date()),
                });
              }
            }

            // Store position in Position table
            const now = new Date();
            const { data: existingPosition } = await supabase
              .from("Position")
              .select("id")
              .eq("accountId", account.id)
              .eq("securityId", securityId)
              .maybeSingle();

            const positionData = {
              accountId: account.id,
              securityId,
              openQuantity: position.openQuantity || 0,
              closedQuantity: position.closedQuantity || 0,
              currentMarketValue: position.currentMarketValue || 0,
              currentPrice: position.currentPrice || 0,
              averageEntryPrice: position.averageEntryPrice || 0,
              closedPnl: position.closedPnl || 0,
              openPnl: position.openPnl || 0,
              totalCost: position.totalCost || 0,
              isRealTime: position.isRealTime || false,
              isUnderReorg: position.isUnderReorg || false,
              lastUpdatedAt: formatTimestamp(now),
              updatedAt: formatTimestamp(now),
            };

            if (existingPosition) {
              // Update existing position
              await supabase
                .from("Position")
                .update(positionData)
                .eq("id", existingPosition.id);
            } else {
              // Create new position
              const positionId = crypto.randomUUID();
              await supabase.from("Position").insert({
                id: positionId,
                ...positionData,
                createdAt: formatTimestamp(now),
              });
            }

            synced++;
          } catch (error: any) {
            console.error(
              `Error processing position ${position.symbol}:`,
              error
            );
            errors++;
          }
        }
      } catch (error: any) {
        console.error(
          `Error syncing positions for account ${account.questradeAccountNumber}:`,
          error
        );
        errors++;
      }
    }

    return { synced, errors };
  } catch (error: any) {
    console.error("Error syncing Questrade holdings:", error);
    throw new Error(error.message || "Failed to sync Questrade holdings");
  }
}

/**
 * Sync Questrade activities (transactions) to InvestmentTransaction table
 */
export async function syncQuestradeTransactions(
  connectionId: string,
  userId: string,
  accountId?: string,
  startTime?: string,
  endTime?: string
): Promise<{ synced: number; skipped: number; errors: number }> {
  try {
    const { accessToken, apiServerUrl } = await getQuestradeConnection(
      connectionId,
      userId
    );

    // startTime is required by Questrade API - default to 30 days ago if not provided
    // Questrade has strict limits on date range (30 days max for activities)
    if (!startTime) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      startTime = thirtyDaysAgo.toISOString();
      console.log(`[Questrade Sync] No startTime provided, using default (30 days ago): ${startTime}`);
    }

    // endTime defaults to now if not provided
    if (!endTime) {
      endTime = new Date().toISOString();
    }

    // Validate date range - Questrade has strict limits on date range (31 days max for activities)
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Questrade limits activities to 31 days maximum
    if (daysDiff > 31) {
      console.log(`[Questrade Sync] Date range too large (${daysDiff} days), limiting to 31 days`);
      const limitedStartDate = new Date(endDate);
      limitedStartDate.setDate(limitedStartDate.getDate() - 31);
      startTime = limitedStartDate.toISOString();
      console.log(`[Questrade Sync] Adjusted startTime to: ${startTime}`);
    }

    const supabase = await createServerClient();

    // Get all Questrade-connected accounts
    let query = supabase
      .from("InvestmentAccount")
      .select("id, questradeAccountNumber")
      .eq("questradeConnectionId", connectionId)
      .eq("isQuestradeConnected", true)
      .eq("userId", userId);

    if (accountId) {
      query = query.eq("id", accountId);
    }

    const { data: accounts, error: accountsError } = await query;

    if (accountsError || !accounts || accounts.length === 0) {
      throw new Error("No Questrade accounts found");
    }

    let synced = 0;
    let skipped = 0;
    let errors = 0;

    for (const account of accounts) {
      if (!account.questradeAccountNumber) continue;

      try {
        // Get activities from Questrade
        // startTime is guaranteed to be set above (defaults to 1 year ago if not provided)
        const activitiesResponse = await getQuestradeActivities(
          apiServerUrl,
          accessToken,
          account.questradeAccountNumber,
          startTime!, // Non-null assertion: startTime is guaranteed to be set
          endTime
        );

        const activities = activitiesResponse.activities;

        for (const activity of activities) {
          try {
            // Only process trade activities (buy/sell)
            if (
              activity.action !== "Buy" &&
              activity.action !== "Sell" &&
              activity.type !== "Trade"
            ) {
              skipped++;
              continue;
            }

            // Find or create Security
            let securityId: string | null = null;

            if (activity.symbol && activity.symbolId) {
              const { data: existingSecurity } = await supabase
                .from("Security")
                .select("id")
                .eq("symbol", activity.symbol)
                .single();

              if (existingSecurity) {
                securityId = existingSecurity.id;
              } else {
                // Create new Security
                securityId = crypto.randomUUID();
                const sector = mapClassToSector("Stock", activity.symbol);

                await supabase.from("Security").insert({
                  id: securityId,
                  symbol: activity.symbol,
                  name: activity.symbol,
                  class: "Stock",
                  sector,
                  createdAt: formatTimestamp(new Date()),
                  updatedAt: formatTimestamp(new Date()),
                });
              }

              // Check if transaction already exists
              const { data: existingTransaction } = await supabase
                .from("InvestmentTransaction")
                .select("id")
                .eq("accountId", account.id)
                .eq("securityId", securityId)
                .eq("date", formatTimestamp(new Date(activity.tradeDate)))
                .eq("type", activity.action.toLowerCase())
                .eq("quantity", activity.quantity || 0)
                .single();

              if (existingTransaction) {
                skipped++;
                continue;
              }

              // Create InvestmentTransaction
              const transactionId = crypto.randomUUID();
              await supabase.from("InvestmentTransaction").insert({
                id: transactionId,
                accountId: account.id,
                securityId,
                date: formatTimestamp(new Date(activity.tradeDate)),
                type: activity.action.toLowerCase(),
                quantity: activity.quantity || 0,
                price: activity.price || 0,
                fees: activity.commission || 0,
                notes: `Questrade: ${activity.type}`,
                createdAt: formatTimestamp(new Date()),
                updatedAt: formatTimestamp(new Date()),
              });

              synced++;
            } else {
              skipped++;
            }
          } catch (error: any) {
            console.error(`Error processing activity:`, error);
            errors++;
          }
        }
      } catch (error: any) {
        console.error(
          `Error syncing transactions for account ${account.questradeAccountNumber}:`,
          error
        );
        errors++;
      }
    }

    return { synced, skipped, errors };
  } catch (error: any) {
    console.error("Error syncing Questrade transactions:", error);
    throw new Error(
      error.message || "Failed to sync Questrade transactions"
    );
  }
}

/**
 * Sync Questrade quotes to SecurityPrice table
 */
export async function syncQuestradeQuotes(
  connectionId: string,
  userId: string
): Promise<{ synced: number; errors: number }> {
  try {
    const { accessToken, apiServerUrl } = await getQuestradeConnection(
      connectionId,
      userId
    );

    const supabase = await createServerClient();

    // Get all securities that need price updates
    const { data: securities, error: securitiesError } = await supabase
      .from("Security")
      .select("id, symbol")
      .limit(100); // Limit to avoid too many API calls

    if (securitiesError || !securities || securities.length === 0) {
      return { synced: 0, errors: 0 };
    }

    // Note: Questrade requires symbolId, not symbol
    // We would need to search for symbols first or store symbolId
    // For now, this is a placeholder that can be enhanced

    return { synced: 0, errors: 0 };
  } catch (error: any) {
    console.error("Error syncing Questrade quotes:", error);
    throw new Error(error.message || "Failed to sync Questrade quotes");
  }
}

/**
 * Sync Questrade orders to Order table
 */
export async function syncQuestradeOrders(
  connectionId: string,
  userId: string,
  accountId?: string,
  stateFilter?: string
): Promise<{ synced: number; errors: number }> {
  try {
    const { accessToken, apiServerUrl } = await getQuestradeConnection(
      connectionId,
      userId
    );

    const supabase = await createServerClient();

    // Get all Questrade-connected accounts
    let query = supabase
      .from("InvestmentAccount")
      .select("id, questradeAccountNumber")
      .eq("questradeConnectionId", connectionId)
      .eq("isQuestradeConnected", true)
      .eq("userId", userId);

    if (accountId) {
      query = query.eq("id", accountId);
    }

    const { data: accounts, error: accountsError } = await query;

    if (accountsError || !accounts || accounts.length === 0) {
      throw new Error("No Questrade accounts found");
    }

    let synced = 0;
    let errors = 0;
    const now = new Date();

    for (const account of accounts) {
      if (!account.questradeAccountNumber) continue;

      try {
        // Get orders from Questrade
        const ordersResponse = await getQuestradeOrders(
          apiServerUrl,
          accessToken,
          account.questradeAccountNumber,
          stateFilter
        );

        const orders = ordersResponse.orders || [];

        for (const order of orders) {
          try {
            // Find or create Security
            let securityId: string;
            const { data: existingSecurity } = await supabase
              .from("Security")
              .select("id")
              .eq("symbol", order.symbol)
              .maybeSingle();

            if (existingSecurity) {
              securityId = existingSecurity.id;
            } else {
              // Create new Security
              securityId = crypto.randomUUID();
              const sector = mapClassToSector("Stock", order.symbol);

              await supabase.from("Security").insert({
                id: securityId,
                symbol: order.symbol,
                name: order.symbol,
                class: "Stock",
                sector,
                createdAt: formatTimestamp(now),
                updatedAt: formatTimestamp(now),
              });
            }

            // Check if order already exists
            const { data: existingOrder } = await supabase
              .from("Order")
              .select("id")
              .eq("questradeOrderId", order.id)
              .eq("accountId", account.id)
              .maybeSingle();

            const orderData = {
              accountId: account.id,
              questradeOrderId: order.id,
              symbolId: order.symbolId,
              symbol: order.symbol,
              totalQuantity: order.totalQuantity || 0,
              openQuantity: order.openQuantity || 0,
              filledQuantity: order.filledQuantity || 0,
              canceledQuantity: order.canceledQuantity || 0,
              side: order.side,
              orderType: order.orderType,
              limitPrice: order.limitPrice || null,
              stopPrice: order.stopPrice || null,
              isAllOrNone: order.isAllOrNone || false,
              isAnonymous: order.isAnonymous || false,
              icebergQuantity: order.icebergQuantity || null,
              minQuantity: order.minQuantity || null,
              avgExecPrice: order.avgExecPrice || null,
              lastExecPrice: order.lastExecPrice || null,
              source: order.source || "",
              timeInForce: order.timeInForce,
              gtdDate: order.gtdDate ? formatTimestamp(new Date(order.gtdDate)) : null,
              state: order.state,
              clientReasonStr: order.clientReasonStr || null,
              chainId: order.chainId,
              creationTime: formatTimestamp(new Date(order.creationTime)),
              updateTime: formatTimestamp(new Date(order.updateTime)),
              notes: order.notes || null,
              primaryRoute: order.primaryRoute || "",
              secondaryRoute: order.secondaryRoute || "",
              orderRoute: order.orderRoute || "",
              venueHoldingOrder: order.venueHoldingOrder || null,
              comissionCharged: order.comissionCharged || null,
              exchangeOrderId: order.exchangeOrderId || null,
              isSignificantShareHolder: order.isSignificantShareHolder || false,
              isInsider: order.isInsider || false,
              isLimitOffsetInTicks: order.isLimitOffsetInTicks || false,
              userId: order.userId || null,
              placementCommission: order.placementCommission || null,
              strategyType: order.strategyType || "",
              triggerStopPrice: order.triggerStopPrice || null,
              lastSyncedAt: formatTimestamp(now),
              updatedAt: formatTimestamp(now),
            };

            if (existingOrder) {
              // Update existing order
              await supabase
                .from("Order")
                .update(orderData)
                .eq("id", existingOrder.id);
            } else {
              // Create new order
              const orderId = crypto.randomUUID();
              await supabase.from("Order").insert({
                id: orderId,
                ...orderData,
                createdAt: formatTimestamp(now),
              });
            }

            synced++;
          } catch (error: any) {
            console.error(`Error processing order ${order.id}:`, error);
            errors++;
          }
        }
      } catch (error: any) {
        console.error(
          `Error syncing orders for account ${account.questradeAccountNumber}:`,
          error
        );
        errors++;
      }
    }

    return { synced, errors };
  } catch (error: any) {
    console.error("Error syncing Questrade orders:", error);
    throw new Error(error.message || "Failed to sync Questrade orders");
  }
}

/**
 * Sync Questrade executions to Execution table
 */
export async function syncQuestradeExecutions(
  connectionId: string,
  userId: string,
  accountId?: string,
  startTime?: string,
  endTime?: string
): Promise<{ synced: number; errors: number }> {
  try {
    const { accessToken, apiServerUrl } = await getQuestradeConnection(
      connectionId,
      userId
    );

    const supabase = await createServerClient();

    // Get all Questrade-connected accounts
    let query = supabase
      .from("InvestmentAccount")
      .select("id, questradeAccountNumber")
      .eq("questradeConnectionId", connectionId)
      .eq("isQuestradeConnected", true)
      .eq("userId", userId);

    if (accountId) {
      query = query.eq("id", accountId);
    }

    const { data: accounts, error: accountsError } = await query;

    if (accountsError || !accounts || accounts.length === 0) {
      throw new Error("No Questrade accounts found");
    }

    // Default to last 30 days if not provided
    if (!startTime) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      startTime = thirtyDaysAgo.toISOString();
    }

    if (!endTime) {
      endTime = new Date().toISOString();
    }

    let synced = 0;
    let errors = 0;
    const now = new Date();

    for (const account of accounts) {
      if (!account.questradeAccountNumber) continue;

      try {
        // Get executions from Questrade
        const executionsResponse = await getQuestradeExecutions(
          apiServerUrl,
          accessToken,
          account.questradeAccountNumber,
          startTime,
          endTime
        );

        const executions = executionsResponse.executions || [];

        for (const execution of executions) {
          try {
            // Find or create Security
            let securityId: string;
            const { data: existingSecurity } = await supabase
              .from("Security")
              .select("id")
              .eq("symbol", execution.symbol)
              .maybeSingle();

            if (existingSecurity) {
              securityId = existingSecurity.id;
            } else {
              // Create new Security
              securityId = crypto.randomUUID();
              const sector = mapClassToSector("Stock", execution.symbol);

              await supabase.from("Security").insert({
                id: securityId,
                symbol: execution.symbol,
                name: execution.symbol,
                class: "Stock",
                sector,
                createdAt: formatTimestamp(now),
                updatedAt: formatTimestamp(now),
              });
            }

            // Check if execution already exists
            const { data: existingExecution } = await supabase
              .from("Execution")
              .select("id")
              .eq("questradeExecutionId", execution.id)
              .eq("accountId", account.id)
              .maybeSingle();

            const executionData = {
              accountId: account.id,
              questradeExecutionId: execution.id,
              symbolId: execution.symbolId,
              symbol: execution.symbol,
              quantity: execution.quantity || 0,
              side: execution.side,
              price: execution.price || 0,
              orderId: execution.orderId,
              orderChainId: execution.orderChainId,
              exchangeExecId: execution.exchangeExecId || "",
              timestamp: formatTimestamp(new Date(execution.timestamp)),
              notes: execution.notes || "",
              venue: execution.venue || "",
              totalCost: execution.totalCost || 0,
              orderPlacementCommission: execution.orderPlacementCommission || 0,
              commission: execution.commission || 0,
              executionFee: execution.executionFee || 0,
              secFee: execution.secFee || 0,
              canadianExecutionFee: execution.canadianExecutionFee || 0,
              parentId: execution.parentId || null,
              lastSyncedAt: formatTimestamp(now),
              updatedAt: formatTimestamp(now),
            };

            if (existingExecution) {
              // Update existing execution
              await supabase
                .from("Execution")
                .update(executionData)
                .eq("id", existingExecution.id);
            } else {
              // Create new execution
              const executionId = crypto.randomUUID();
              await supabase.from("Execution").insert({
                id: executionId,
                ...executionData,
                createdAt: formatTimestamp(now),
              });
            }

            synced++;
          } catch (error: any) {
            console.error(`Error processing execution ${execution.id}:`, error);
            errors++;
          }
        }
      } catch (error: any) {
        console.error(
          `Error syncing executions for account ${account.questradeAccountNumber}:`,
          error
        );
        errors++;
      }
    }

    return { synced, errors };
  } catch (error: any) {
    console.error("Error syncing Questrade executions:", error);
    throw new Error(error.message || "Failed to sync Questrade executions");
  }
}

/**
 * Sync Questrade candles (historical price data) to Candle table
 */
export async function syncQuestradeCandles(
  connectionId: string,
  userId: string,
  symbolId: number,
  startTime: string,
  endTime: string,
  interval: 'OneMinute' | 'TwoMinutes' | 'ThreeMinutes' | 'FourMinutes' | 'FiveMinutes' | 'TenMinutes' | 'FifteenMinutes' | 'TwentyMinutes' | 'HalfHour' | 'OneHour' | 'TwoHours' | 'FourHours' | 'OneDay' | 'OneWeek' | 'OneMonth' | 'OneYear' = 'OneDay'
): Promise<{ synced: number; errors: number }> {
  try {
    const { accessToken, apiServerUrl } = await getQuestradeConnection(
      connectionId,
      userId
    );

    const supabase = await createServerClient();

    // Find security by symbolId
    const { data: security } = await supabase
      .from("Security")
      .select("id, symbol")
      .eq("symbol", symbolId.toString()) // Note: This might need adjustment based on how symbolId is stored
      .maybeSingle();

    if (!security) {
      throw new Error(`Security not found for symbolId ${symbolId}`);
    }

    // Get candles from Questrade
    const candlesResponse = await getQuestradeCandles(
      apiServerUrl,
      accessToken,
      symbolId,
      startTime,
      endTime,
      interval
    );

    const candles = candlesResponse.candles || [];
    let synced = 0;
    let errors = 0;
    const now = new Date();

    for (const candle of candles) {
      try {
        // Check if candle already exists
        const { data: existingCandle } = await supabase
          .from("Candle")
          .select("id")
          .eq("securityId", security.id)
          .eq("start", formatTimestamp(new Date(candle.start)))
          .eq("end", formatTimestamp(new Date(candle.end)))
          .eq("interval", interval)
          .maybeSingle();

        const candleData = {
          securityId: security.id,
          symbolId: symbolId,
          start: formatTimestamp(new Date(candle.start)),
          end: formatTimestamp(new Date(candle.end)),
          low: candle.low || 0,
          high: candle.high || 0,
          open: candle.open || 0,
          close: candle.close || 0,
          volume: candle.volume || 0,
          VWAP: candle.VWAP || null,
          interval: interval,
          updatedAt: formatTimestamp(now),
        };

        if (existingCandle) {
          // Update existing candle
          await supabase
            .from("Candle")
            .update(candleData)
            .eq("id", existingCandle.id);
        } else {
          // Create new candle
          const candleId = crypto.randomUUID();
          await supabase.from("Candle").insert({
            id: candleId,
            ...candleData,
            createdAt: formatTimestamp(now),
          });
        }

        synced++;
      } catch (error: any) {
        console.error(`Error processing candle for ${candle.start}:`, error);
        errors++;
      }
    }

    return { synced, errors };
  } catch (error: any) {
    console.error("Error syncing Questrade candles:", error);
    throw new Error(error.message || "Failed to sync Questrade candles");
  }
}

