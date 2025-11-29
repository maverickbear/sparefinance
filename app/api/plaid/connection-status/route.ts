import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/src/infrastructure/database/supabase-server';
import { getCurrentUserId } from '@/src/application/shared/feature-guard';
import { cache } from '@/src/infrastructure/external/redis';

export async function GET(req: NextRequest) {
  try {
    // Get current user
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // PERFORMANCE: Check cache first (connection status doesn't change frequently)
    const cacheKey = `plaid:connection-status:${userId}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const supabase = await createServerClient();

    // Get all PlaidConnection records for the user
    const { data: connections, error: connectionsError } = await supabase
      .from('PlaidConnection')
      .select('id, itemId, institutionId, institutionName, institutionLogo')
      .eq('userId', userId);

    if (connectionsError) {
      console.error('Error fetching PlaidConnections:', connectionsError);
      return NextResponse.json(
        { error: 'Failed to fetch connection status' },
        { status: 500 }
      );
    }

    if (!connections || connections.length === 0) {
      return NextResponse.json({
        hasConnections: false,
        connectionCount: 0,
        accountCount: 0,
        institutions: [],
      });
    }

    // PERFORMANCE: Count connected accounts in parallel instead of sequentially
    // This reduces total query time from N sequential queries to 1 parallel query
    const itemIds = connections.map(c => c.itemId);
    
    // Get all connected accounts for all itemIds in one query
    const { data: allAccounts, error: accountsError } = await supabase
      .from('Account')
      .select('id, plaidItemId')
      .in('plaidItemId', itemIds)
      .eq('isConnected', true);

    if (accountsError) {
      console.error('Error counting accounts:', accountsError);
      return NextResponse.json(
        { error: 'Failed to fetch account counts' },
        { status: 500 }
      );
    }

    // Count accounts per itemId
    const accountCountByItemId = new Map<string, number>();
    allAccounts?.forEach(account => {
      const count = accountCountByItemId.get(account.plaidItemId) || 0;
      accountCountByItemId.set(account.plaidItemId, count + 1);
    });

    // Build institutions map and calculate total
    let totalAccountCount = 0;
    const institutionsMap = new Map<string, {
      id: string;
      name: string | null;
      logo: string | null;
      accountCount: number;
    }>();

    for (const connection of connections) {
      const accountCount = accountCountByItemId.get(connection.itemId) || 0;
      totalAccountCount += accountCount;

      // Use institutionId as key, or itemId if institutionId is not available
      const institutionKey = connection.institutionId || connection.itemId;
      
      // If institution already exists, add to account count; otherwise create new entry
      if (institutionsMap.has(institutionKey)) {
        const existing = institutionsMap.get(institutionKey)!;
        existing.accountCount += accountCount;
      } else {
        institutionsMap.set(institutionKey, {
          id: institutionKey,
          name: connection.institutionName,
          logo: connection.institutionLogo,
          accountCount,
        });
      }
    }

    // Convert map to array
    const institutions = Array.from(institutionsMap.values());

    const result = {
      hasConnections: true,
      connectionCount: connections.length,
      accountCount: totalAccountCount,
      institutions,
    };

    // Cache result for 2 minutes (connection status doesn't change frequently)
    await cache.set(cacheKey, result, 120);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error getting connection status:', error);
    return NextResponse.json(
      { error: 'Failed to get connection status' },
      { status: 500 }
    );
  }
}

