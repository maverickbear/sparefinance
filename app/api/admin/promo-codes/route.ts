import { NextRequest, NextResponse } from "next/server";
import {
  getAllPromoCodes,
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
  togglePromoCodeActive,
} from "@/lib/api/admin";

export async function GET(request: NextRequest) {
  try {
    const promoCodes = await getAllPromoCodes();
    return NextResponse.json({ promoCodes });
  } catch (error: any) {
    console.error("Error fetching promo codes:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch promo codes" },
      { status: error.message?.includes("Unauthorized") ? 403 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      code,
      discountType,
      discountValue,
      duration,
      durationInMonths,
      maxRedemptions,
      expiresAt,
      planIds,
    } = body;

    if (!code || !discountType || discountValue === undefined || !duration) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const promoCode = await createPromoCode({
      code,
      discountType,
      discountValue: parseFloat(discountValue),
      duration,
      durationInMonths: durationInMonths ? parseInt(durationInMonths) : undefined,
      maxRedemptions: maxRedemptions ? parseInt(maxRedemptions) : undefined,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      planIds: planIds || [],
    });

    return NextResponse.json({ promoCode });
  } catch (error: any) {
    console.error("Error creating promo code:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create promo code" },
      { status: error.message?.includes("Unauthorized") ? 403 : 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      code,
      discountType,
      discountValue,
      duration,
      durationInMonths,
      maxRedemptions,
      expiresAt,
      isActive,
      planIds,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Missing id field" },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (code !== undefined) updateData.code = code;
    if (discountType !== undefined) updateData.discountType = discountType;
    if (discountValue !== undefined) updateData.discountValue = parseFloat(discountValue);
    if (duration !== undefined) updateData.duration = duration;
    if (durationInMonths !== undefined) updateData.durationInMonths = parseInt(durationInMonths);
    if (maxRedemptions !== undefined) updateData.maxRedemptions = maxRedemptions ? parseInt(maxRedemptions) : null;
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (planIds !== undefined) updateData.planIds = planIds;

    const promoCode = await updatePromoCode(id, updateData);

    return NextResponse.json({ promoCode });
  } catch (error: any) {
    console.error("Error updating promo code:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update promo code" },
      { status: error.message?.includes("Unauthorized") ? 403 : 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Missing id parameter" },
        { status: 400 }
      );
    }

    await deletePromoCode(id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting promo code:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete promo code" },
      { status: error.message?.includes("Unauthorized") ? 403 : 500 }
    );
  }
}

