import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceRoleClient } from "../../../../src/infrastructure/database/supabase-server";

async function isSuperAdmin(): Promise<boolean> {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return false;
    }

    const { data: userData } = await supabase
      .from("User")
      .select("role")
      .eq("id", user.id)
      .single();

    return userData?.role === "super_admin";
  } catch (error) {
    console.error("Error checking super_admin status:", error);
    return false;
  }
}

/**
 * GET /api/admin/user-subscriptions
 * Get all user service subscriptions from all users
 */
export async function GET() {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Use service role client to bypass RLS
    const supabase = createServiceRoleClient();

    // Get all user service subscriptions
    const { data: subscriptions, error } = await supabase
      .from("UserServiceSubscription")
      .select("*")
      .order("createdAt", { ascending: false });

    if (error) {
      console.error("Error fetching user subscriptions:", error);
      return NextResponse.json(
        { error: "Failed to fetch user subscriptions" },
        { status: 500 }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ subscriptions: [] });
    }

    // Collect all unique IDs for batch fetching
    const userIds = new Set<string>();
    const accountIds = new Set<string>();
    const subcategoryIds = new Set<string>();
    const serviceNames = new Set<string>();

    subscriptions.forEach((sub: any) => {
      if (sub.userId) userIds.add(sub.userId);
      if (sub.accountId) accountIds.add(sub.accountId);
      if (sub.subcategoryId) subcategoryIds.add(sub.subcategoryId);
      if (sub.serviceName) serviceNames.add(sub.serviceName);
    });

    // Batch fetch all related data in parallel
    const [usersResult, accountsResult, subcategoriesResult, servicesResult] = await Promise.all([
      userIds.size > 0
        ? supabase.from("User").select("id, email, name").in("id", Array.from(userIds))
        : Promise.resolve({ data: [], error: null }),
      accountIds.size > 0
        ? supabase.from("Account").select("id, name").in("id", Array.from(accountIds))
        : Promise.resolve({ data: [], error: null }),
      subcategoryIds.size > 0
        ? supabase.from("Subcategory").select("id, name, logo").in("id", Array.from(subcategoryIds))
        : Promise.resolve({ data: [], error: null }),
      serviceNames.size > 0
        ? supabase.from("SubscriptionService").select("name, logo").in("name", Array.from(serviceNames))
        : Promise.resolve({ data: [], error: null }),
    ]);

    // Create maps for O(1) lookup
    const usersMap = new Map((usersResult.data || []).map((u: any) => [u.id, u]));
    const accountsMap = new Map((accountsResult.data || []).map((a: any) => [a.id, a]));
    const subcategoriesMap = new Map((subcategoriesResult.data || []).map((s: any) => [s.id, s]));
    const servicesMap = new Map((servicesResult.data || []).map((s: any) => [s.name, s]));

    // Enrich subscriptions with related data
    const enrichedSubscriptions = subscriptions.map((sub: any) => ({
      ...sub,
      amount: Number(sub.amount),
      User: sub.userId ? (usersMap.get(sub.userId) || null) : null,
      Account: sub.accountId ? (accountsMap.get(sub.accountId) || null) : null,
      Subcategory: sub.subcategoryId ? (subcategoriesMap.get(sub.subcategoryId) || null) : null,
      serviceLogo: servicesMap.get(sub.serviceName)?.logo || null,
    }));

    return NextResponse.json({ subscriptions: enrichedSubscriptions });
  } catch (error) {
    console.error("Error in GET /api/admin/user-subscriptions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

