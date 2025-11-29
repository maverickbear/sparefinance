import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { validateImageFile, sanitizeFilename, getFileExtension } from "@/lib/utils/file-validation";
import { SecurityLogger } from "@/src/infrastructure/utils/security-logging";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    
    // Get current user
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !authUser) {
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || 
                 request.headers.get("x-real-ip") || 
                 "unknown";
      const userAgent = request.headers.get("user-agent") || "unknown";
      SecurityLogger.unauthorizedAccess(
        "Unauthorized avatar upload attempt",
        { ip, userAgent }
      );
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

    // Convert File to ArrayBuffer for validation
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Comprehensive file validation
    const validation = await validateImageFile(file, buffer);
    if (!validation.valid) {
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || 
                 request.headers.get("x-real-ip") || 
                 "unknown";
      const userAgent = request.headers.get("user-agent") || "unknown";
      SecurityLogger.invalidFileUpload(
        `Invalid file upload attempt by user ${authUser.id}`,
        {
          userId: authUser.id,
          ip,
          userAgent,
          details: {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            error: validation.error,
          },
        }
      );
      return NextResponse.json(
        { error: validation.error || "Invalid file" },
        { status: 400 }
      );
    }

    // Sanitize filename
    const sanitizedOriginalName = sanitizeFilename(file.name);
    const fileExt = getFileExtension(sanitizedOriginalName) || getFileExtension(file.name) || "jpg";
    
    // Generate unique filename with sanitized extension
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const fileName = `${authUser.id}/${timestamp}-${randomSuffix}.${fileExt}`;

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

