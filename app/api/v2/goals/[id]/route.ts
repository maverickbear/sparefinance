import { NextRequest, NextResponse } from "next/server";
import { makeGoalsService } from "@/src/application/goals/goals.factory";
import { GoalFormData } from "@/src/domain/goals/goals.validations";
import { ZodError } from "zod";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const service = makeGoalsService();
    const goal = await service.getGoalById(id);
    
    if (!goal) {
      return NextResponse.json(
        { error: "Goal not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(goal, { status: 200 });
  } catch (error) {
    console.error("Error fetching goal:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch goal" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const service = makeGoalsService();
    const goal = await service.updateGoal(id, body);
    
    return NextResponse.json(goal, { status: 200 });
  } catch (error) {
    console.error("Error updating goal:", error);
    
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') },
        { status: 400 }
      );
    }
    
    const errorMessage = error instanceof Error ? error.message : "Failed to update goal";
    const statusCode = errorMessage.includes("Unauthorized") ? 401 : 400;
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const service = makeGoalsService();
    await service.deleteGoal(id);
    
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting goal:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete goal" },
      { status: 400 }
    );
  }
}

