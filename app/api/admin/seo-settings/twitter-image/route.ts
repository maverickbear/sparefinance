import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceRoleClient } from "@/src/infrastructure/database/supabase-server";
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
 * POST /api/admin/seo-settings/twitter-image
 * Upload a Twitter Card image to the images bucket in Supabase Storage
 * Only accessible by super_admin
 */
export async function POST(request: NextRequest) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const validation = await validateImageFile(file, buffer);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || "Invalid file" },
        { status: 400 }
      );
    }

    const sanitizedOriginalName = sanitizeFilename(file.name);
    const fileExt = getFileExtension(sanitizedOriginalName) || getFileExtension(file.name) || "png";
    
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const fileName = `twitter-images/${timestamp}-${randomSuffix}.${fileExt}`;

    // Use service role client to bypass RLS for admin operations
    // We've already verified the user is super_admin above
    const supabase = createServiceRoleClient();

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("images")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Error uploading Twitter image:", uploadError);
      return NextResponse.json(
        { error: uploadError.message || "Failed to upload image" },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from("images")
      .getPublicUrl(fileName);

    if (!urlData?.publicUrl) {
      return NextResponse.json(
        { error: "Failed to get image URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: urlData.publicUrl });
  } catch (error) {
    console.error("Error in POST /api/admin/seo-settings/twitter-image:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

