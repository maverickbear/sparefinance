import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { contactFormSchema } from "@/lib/validations/contact";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    
    // Get current user (optional - can be null for non-authenticated submissions)
    const { data: { user } } = await supabase.auth.getUser();
    
    // Parse and validate request body
    const body = await request.json();
    const validatedData = contactFormSchema.parse(body);

    // Insert contact form submission
    const { data, error } = await supabase
      .from("ContactForm")
      .insert({
        userId: user?.id || null,
        name: validatedData.name,
        email: validatedData.email,
        subject: validatedData.subject,
        message: validatedData.message,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error("Error inserting contact form:", error);
      return NextResponse.json(
        { error: "Failed to submit contact form" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error("Error in contact form API:", error);
    
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

