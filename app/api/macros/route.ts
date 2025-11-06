import { NextResponse } from "next/server";
import { createMacro } from "@/lib/api/categories";

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const macro = await createMacro({
      name: data.name,
    });
    return NextResponse.json(macro);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to create macro";
    const statusCode = errorMessage.includes("Unauthorized") ? 401 : 
                      errorMessage.includes("paid plan") ? 403 : 500;
    return NextResponse.json({ error: errorMessage }, { status: statusCode });
  }
}

