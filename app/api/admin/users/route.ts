import { NextRequest, NextResponse } from "next/server";
import { getAllUsers } from "@/lib/api/admin";

export async function GET(request: NextRequest) {
  try {
    const users = await getAllUsers();
    return NextResponse.json({ users });
  } catch (error: any) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch users" },
      { status: error.message?.includes("Unauthorized") ? 403 : 500 }
    );
  }
}

