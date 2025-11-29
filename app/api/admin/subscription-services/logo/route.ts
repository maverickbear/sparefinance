import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { validateImageFile, sanitizeFilename, getFileExtension } from "@/lib/utils/file-validation";

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
 * POST /api/admin/subscription-services/logo
 * Upload a logo to the logos bucket in Supabase Storage
 * Only accessible by super_admin
 */
export async function POST(request: NextRequest) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
      return NextResponse.json(
        { error: validation.error || "Invalid file" },
        { status: 400 }
      );
    }

    // Sanitize filename
    const sanitizedOriginalName = sanitizeFilename(file.name);
    const fileExt = getFileExtension(sanitizedOriginalName) || getFileExtension(file.name) || "png";
    
    // Generate unique filename
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const fileName = `${timestamp}-${randomSuffix}.${fileExt}`;

    // Use server client with RLS policies (super_admin can upload via RLS)
    const supabase = await createServerClient();

    // Upload to Supabase Storage (logos bucket)
    // RLS policy allows super_admin to upload
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("logos")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Error uploading logo:", uploadError);
      return NextResponse.json(
        { error: uploadError.message || "Failed to upload logo" },
        { status: 500 }
      );
    }

    // Get public URL for the uploaded file
    const { data: urlData } = supabase.storage
      .from("logos")
      .getPublicUrl(fileName);

    if (!urlData?.publicUrl) {
      return NextResponse.json(
        { error: "Failed to get logo URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: urlData.publicUrl });
  } catch (error) {
    console.error("Error in POST /api/admin/subscription-services/logo:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

