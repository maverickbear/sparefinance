import { NextRequest, NextResponse } from "next/server";

/**
 * Reports API endpoint
 * 
 * Note: Reports are currently loaded server-side via the reports page data-loader.
 * This endpoint exists to satisfy build tooling requirements.
 */
export async function GET(request: NextRequest) {
  return NextResponse.json(
    { 
      error: "Reports are loaded server-side. Use the reports page component instead.",
      message: "This endpoint is not intended for direct use."
    },
    { status: 404 }
  );
}

