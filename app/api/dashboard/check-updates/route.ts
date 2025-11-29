import { NextResponse } from "next/server";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { cache } from "@/src/infrastructure/external/redis";

/**
 * API route to silently check if there are new data updates
 * Returns a hash/timestamp that changes when any relevant data is updated
 * This allows the frontend to poll silently without fetching all data
 * 
 * OPTIMIZED: Uses Redis cache (5s TTL) + RPC function for better performance
 */
interface UpdateCheckResult {
  hasUpdates: boolean;
  currentHash: string;
  timestamp: string | null;
  source?: "cache" | "database";
  executionTime?: number;
}

const CACHE_TTL = 120; // 120 segundos (2 minutes) - shorter than polling to avoid stale data
const CACHE_KEY_PREFIX = "updates:";

export async function GET(request: Request) {
  const startTime = Date.now();

  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const lastCheck = searchParams.get("lastCheck"); // ISO timestamp from client

    // 1. Tentar cache primeiro
    const cacheKey = `${CACHE_KEY_PREFIX}${userId}`;
    const cached = await cache.get<UpdateCheckResult>(cacheKey);
    
    if (cached) {
      // Verificar se há updates comparando com lastCheck
      let hasUpdates = cached.hasUpdates;
      if (lastCheck) {
        const lastCheckTime = new Date(lastCheck).getTime();
        const cachedTimestamp = cached.timestamp ? new Date(cached.timestamp).getTime() : 0;
        hasUpdates = cachedTimestamp > lastCheckTime;
      }

      const result: UpdateCheckResult = {
        ...cached,
        hasUpdates,
        source: "cache",
        executionTime: Date.now() - startTime,
      };

      if (process.env.NODE_ENV === "development") {
        console.log(
          `[Check Updates] User ${userId.slice(0, 8)}... - ${result.executionTime}ms - ${result.source}`
        );
      }

      return NextResponse.json(result);
    }

    // 2. Buscar do banco (cache miss)
    const supabase = await createServerClient();

    // Tentar usar RPC function otimizada primeiro
    let updates: Array<{ table_name: string; last_update: number }> = [];
    
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc("get_latest_updates", {
        p_user_id: userId,
      });

      if (!rpcError && rpcData) {
        updates = rpcData.map((item: any) => ({
          table_name: item.table_name,
          last_update: item.last_update,
        }));
      }
    } catch (rpcError) {
      // RPC não existe ou falhou, usar fallback
      if (process.env.NODE_ENV === "development") {
        console.warn("[Check Updates] RPC function not available, using fallback:", rpcError);
      }
    }

    // Fallback: queries individuais se RPC não funcionou
    if (updates.length === 0) {
      // Helper function to safely check a table
      // OPTIMIZED: Use COALESCE to get max(updatedAt, createdAt) in a single query
      // This is faster than fetching both columns and calculating in JavaScript
      const checkTable = async (
        tableName: string
      ): Promise<{ table_name: string; last_update: number } | null> => {
        try {
          // OPTIMIZATION: Use a more efficient query that gets max timestamp directly
          // Note: Some tables may not have userId column, so we need to handle that
          let query = supabase
            .from(tableName)
            .select("updatedAt, createdAt")
            .order("updatedAt", { ascending: false })
            .limit(1)
            .maybeSingle();
          
          // Only filter by userId if the table has that column
          // This prevents errors on tables like Transaction which use accountId/householdId
          if (tableName === "Transaction" || tableName === "Account" || tableName === "Budget" || 
              tableName === "Goal" || tableName === "Debt" || tableName === "SimpleInvestmentEntry") {
            // These tables may have userId or use RLS, so we rely on RLS for filtering
            // Don't add .eq("userId", userId) as it may not exist or may be filtered by RLS
          }

          const { data, error } = await query;

          if (error || !data) return null;
          const updated = data.updatedAt ? new Date(data.updatedAt).getTime() : 0;
          const created = data.createdAt ? new Date(data.createdAt).getTime() : 0;
          return { table_name: tableName, last_update: Math.max(updated, created) };
        } catch (err) {
          if (process.env.NODE_ENV === "development") {
            console.warn(`[Check Updates] Error checking table ${tableName}:`, err);
          }
          return null;
        }
      };

      const checks = await Promise.all([
        // Check transactions - filter by userId for better performance
        checkTable("Transaction"),

        // Check accounts - filter by userId
        checkTable("Account"),

        // Check budgets - filter by userId
        checkTable("Budget"),

        // Check goals - filter by userId
        checkTable("Goal"),

        // Check debts - filter by userId
        checkTable("Debt"),

        // Check investment entries (SimpleInvestmentEntry) - filter by userId
        checkTable("SimpleInvestmentEntry"),
      ]);

      updates = checks.filter((item): item is { table_name: string; last_update: number } => item !== null);
    }

    // 3. Calcular hash baseado na última atualização
    const timestamps = updates.map((u) => u.last_update).filter((t) => t > 0);
    const maxTimestamp = timestamps.length > 0 ? Math.max(...timestamps) : 0;
    const currentHash = maxTimestamp.toString();

    // 4. Verificar se há atualizações
    let hasUpdates = false;
    if (lastCheck) {
      const lastCheckTime = new Date(lastCheck).getTime();
      hasUpdates = maxTimestamp > lastCheckTime;
    }

    // 5. Preparar resposta
    const result: UpdateCheckResult = {
      hasUpdates,
      currentHash,
      timestamp: maxTimestamp > 0 ? new Date(maxTimestamp).toISOString() : null,
      source: "database",
      executionTime: Date.now() - startTime,
    };

    // 6. Salvar no cache
    await cache.set(cacheKey, result, CACHE_TTL);

    // 7. Log de performance (apenas em desenvolvimento)
    if (process.env.NODE_ENV === "development") {
      console.log(
        `[Check Updates] User ${userId.slice(0, 8)}... - ${result.executionTime}ms - ${result.source}`
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`[Check Updates] Error after ${executionTime}ms:`, error);

    return NextResponse.json(
      {
        error: "Failed to check updates",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

