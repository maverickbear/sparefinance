import { NextRequest, NextResponse } from "next/server";

/**
 * Subscription Service Plans API - DISABLED
 * 
 * Plan creation functionality has been removed. Users now enter subscription
 * amounts manually when creating their subscriptions.
 * 
 * This endpoint is kept for backward compatibility but returns 410 Gone.
 */

export async function GET(request: NextRequest) {
  return NextResponse.json(
    { error: "Plan management has been disabled. Users enter amounts manually." },
    { status: 410 }
  );
}

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: "Plan creation has been disabled. Users enter amounts manually." },
    { status: 410 }
  );
}

export async function PUT(request: NextRequest) {
  return NextResponse.json(
    { error: "Plan updates have been disabled. Users enter amounts manually." },
    { status: 410 }
  );
}

export async function DELETE(request: NextRequest) {
  return NextResponse.json(
    { error: "Plan deletion has been disabled." },
    { status: 410 }
  );
}

