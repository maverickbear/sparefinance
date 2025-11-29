import { NextRequest, NextResponse } from "next/server";
import { makeGoalsService } from "@/src/application/goals/goals.factory";
import { GoalFormData, goalSchema } from "@/src/domain/goals/goals.validations";
import { ZodError } from "zod";

export async function GET(request: NextRequest) {
  try {
    const service = makeGoalsService();
    const goals = await service.getGoals();
    
    return NextResponse.json(goals, { status: 200 });
  } catch (error) {
    console.error("Error fetching goals:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch goals" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate with schema
    const validatedData = goalSchema.parse(body);
    
    const service = makeGoalsService();
    const goal = await service.createGoal(validatedData);
    
    return NextResponse.json(goal, { status: 201 });
  } catch (error) {
    console.error("Error creating goal:", error);
    
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') },
        { status: 400 }
      );
    }
    
    const errorMessage = error instanceof Error ? error.message : "Failed to create goal";
    const statusCode = errorMessage.includes("Unauthorized") ? 401 : 400;
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

