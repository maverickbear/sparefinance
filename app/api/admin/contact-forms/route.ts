import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    
    // Check if user is super admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is super admin
    const { data: userData, error: userError } = await supabase
      .from("User")
      .select("role")
      .eq("id", user.id)
      .single();

    if (userError || userData?.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build query
    let query = supabase
      .from("ContactForm")
      .select(`
        id,
        userId,
        name,
        email,
        subject,
        message,
        status,
        adminNotes,
        createdAt,
        updatedAt,
        User:userId (
          id,
          name,
          email
        )
      `)
      .order("createdAt", { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by status if provided
    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching contact forms:", error);
      return NextResponse.json(
        { error: "Failed to fetch contact forms" },
        { status: 500 }
      );
    }

    // Get total count
    let countQuery = supabase.from("ContactForm").select("*", { count: "exact", head: true });
    if (status) {
      countQuery = countQuery.eq("status", status);
    }
    const { count } = await countQuery;

    return NextResponse.json({
      contactForms: data || [],
      total: count || 0,
    });
  } catch (error) {
    console.error("Error in contact forms API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    
    // Check if user is super admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is super admin
    const { data: userData, error: userError } = await supabase
      .from("User")
      .select("role")
      .eq("id", user.id)
      .single();

    if (userError || userData?.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { id, status, adminNotes } = body;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (status) {
      updateData.status = status;
    }

    if (adminNotes !== undefined) {
      updateData.adminNotes = adminNotes;
    }

    const { data, error } = await supabase
      .from("ContactForm")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating contact form:", error);
      return NextResponse.json(
        { error: "Failed to update contact form" },
        { status: 500 }
      );
    }

    return NextResponse.json({ contactForm: data });
  } catch (error) {
    console.error("Error in contact forms API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

