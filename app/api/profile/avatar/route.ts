import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    
    // Get current user
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get file from FormData
    const formData = await request.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "File must be an image" },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size must be less than 5MB" },
        { status: 400 }
      );
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${authUser.id}/${Date.now()}.${fileExt}`;
    
    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("avatar")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true, // Replace existing file if it exists
      });

    if (uploadError) {
      console.error("Error uploading avatar:", uploadError);
      return NextResponse.json(
        { error: uploadError.message || "Failed to upload avatar" },
        { status: 400 }
      );
    }

    // Get public URL for the uploaded file
    const { data: urlData } = supabase.storage
      .from("avatar")
      .getPublicUrl(fileName);

    if (!urlData?.publicUrl) {
      return NextResponse.json(
        { error: "Failed to get avatar URL" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { url: urlData.publicUrl },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error uploading avatar:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload avatar" },
      { status: 500 }
    );
  }
}

