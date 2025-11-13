import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { feedbackSchema } from "@/lib/validations/feedback";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    
    // Get current user (required for feedback)
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    // Parse and validate request body
    const body = await request.json();
    const validatedData = feedbackSchema.parse(body);

    // Insert feedback submission
    const { data, error } = await supabase
      .from("Feedback")
      .insert({
        userId: user.id,
        rating: validatedData.rating,
        feedback: validatedData.feedback || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error inserting feedback:", error);
      return NextResponse.json(
        { error: "Failed to submit feedback" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error("Error in feedback API:", error);
    
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid form data", details: error },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

