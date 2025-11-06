import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export interface Household {
  id: string; // ownerId
  name: string;
  email: string;
  isOwner: boolean; // true if the current user is the owner
}

export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const householdsMap = new Map<string, Household>();

    // 1. Add the current user's own household (they are the owner)
    const { data: currentUser } = await supabase
      .from("User")
      .select("id, name, email")
      .eq("id", authUser.id)
      .single();

    if (currentUser) {
      householdsMap.set(currentUser.id, {
        id: currentUser.id,
        name: currentUser.name || currentUser.email,
        email: currentUser.email,
        isOwner: true,
      });
    }

    // 2. Add households where the user is a member
    const { data: memberHouseholds } = await supabase
      .from("HouseholdMember")
      .select("ownerId")
      .eq("memberId", authUser.id)
      .eq("status", "active");

    if (memberHouseholds && memberHouseholds.length > 0) {
      const ownerIds = [...new Set(memberHouseholds.map(m => m.ownerId))];
      
      const { data: owners } = await supabase
        .from("User")
        .select("id, name, email")
        .in("id", ownerIds);

      if (owners) {
        owners.forEach(owner => {
          // Only add if not already in map (avoid duplicates)
          if (!householdsMap.has(owner.id)) {
            householdsMap.set(owner.id, {
              id: owner.id,
              name: owner.name || owner.email,
              email: owner.email,
              isOwner: false,
            });
          }
        });
      }
    }

    // Convert map to array to ensure unique households
    const households = Array.from(householdsMap.values());

    return NextResponse.json(households);
  } catch (error) {
    console.error("Error fetching households:", error);
    return NextResponse.json(
      { error: "Failed to fetch households" },
      { status: 500 }
    );
  }
}

