import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";

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
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Get all feedbacks with user info
    const { data: feedbacks, error: feedbacksError } = await supabase
      .from("Feedback")
      .select(`
        id,
        userId,
        rating,
        feedback,
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

    if (feedbacksError) {
      console.error("Error fetching feedbacks:", feedbacksError);
      return NextResponse.json(
        { error: "Failed to fetch feedbacks" },
        { status: 500 }
      );
    }

    // Get total count
    const { count } = await supabase
      .from("Feedback")
      .select("*", { count: "exact", head: true });

    // Calculate metrics
    const { data: allFeedbacks } = await supabase
      .from("Feedback")
      .select("rating");

    const metrics = {
      total: count || 0,
      averageRating: 0,
      ratingDistribution: {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      },
    };

    if (allFeedbacks && allFeedbacks.length > 0) {
      const totalRating = allFeedbacks.reduce((sum, f) => sum + f.rating, 0);
      metrics.averageRating = totalRating / allFeedbacks.length;

      allFeedbacks.forEach((f) => {
        if (f.rating >= 1 && f.rating <= 5) {
          metrics.ratingDistribution[f.rating as keyof typeof metrics.ratingDistribution]++;
        }
      });
    }

    return NextResponse.json({
      feedbacks: feedbacks || [],
      total: count || 0,
      metrics,
    });
  } catch (error) {
    console.error("Error in feedback API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

