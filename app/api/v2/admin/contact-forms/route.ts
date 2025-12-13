import { NextRequest, NextResponse } from "next/server";
import { makeAdminService } from "@/src/application/admin/admin.factory";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { updateContactFormSchema } from "@/src/domain/admin/admin.validations";
import { z } from "zod";
import { AppError } from "@/src/application/shared/app-error";

/**
 * GET /api/v2/admin/contact-forms
 * Get all contact forms with pagination
 * Only accessible by super_admin
 */

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const service = makeAdminService();
    
    // Check if user is super_admin
    if (!(await service.isSuperAdmin(userId))) {
      return NextResponse.json(
        { error: "Unauthorized: Only super_admin can access this endpoint" },
        { status: 403 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") || undefined;
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    const result = await service.getContactForms({ status, limit, offset });

    return NextResponse.json(result, {
    });
  } catch (error) {
    console.error("Error fetching contact forms:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch contact forms" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v2/admin/contact-forms
 * Update a contact form
 * Only accessible by super_admin
 */
export async function PUT(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const service = makeAdminService();
    
    // Check if user is super_admin
    if (!(await service.isSuperAdmin(userId))) {
      return NextResponse.json(
        { error: "Unauthorized: Only super_admin can access this endpoint" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validated = updateContactFormSchema.parse(body);

    const contactForm = await service.updateContactForm(validated.id, {
      status: validated.status,
      adminNotes: validated.adminNotes,
    });

    return NextResponse.json({ contactForm });
  } catch (error) {
    console.error("Error updating contact form:", error);

    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update contact form" },
      { status: 500 }
    );
  }
}

