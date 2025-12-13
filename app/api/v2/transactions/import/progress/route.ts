import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { progressTracker } from "@/src/infrastructure/utils/progress-tracker";

/**
 * GET /api/v2/transactions/import/progress?jobId=xxx
 * Get progress of a transaction import job
 */

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json(
        { error: "jobId parameter is required" },
        { status: 400 }
      );
    }

    const progress = progressTracker.get(jobId);

    if (!progress) {
      return NextResponse.json(
        { error: "Job not found or expired" },
        { status: 404 }
      );
    }

    return NextResponse.json(progress, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error("[IMPORT-PROGRESS] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get progress" },
      { status: 500 }
    );
  }
}

