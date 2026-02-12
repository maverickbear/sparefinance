/**
 * POST /api/v2/blog/generate-with-ai
 * Generates blog post content (title, description, body) using OpenAI.
 * Called from Sanity Studio "Generate with AI" document action.
 * Same-origin only (Studio is on same host).
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

const bodySchema = z.object({
  topic: z.string().min(1).max(200),
  keywords: z.array(z.string().max(50)).max(10).optional(),
});

function slugFromTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { message: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Invalid body", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { topic, keywords } = parsed.data;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `You are a writer for Spare Finance, a personal finance app blog. Write a short, practical blog post in English.

Topic: ${topic}
${keywords?.length ? `Keywords to include (optional): ${keywords.join(", ")}` : ""}

Return a JSON object with exactly these keys (no extra keys):
- "title": string, catchy title, max 80 chars
- "description": string, 1-2 sentences for meta description, max 300 chars
- "body": string, the post body in plain text. Use double newlines between paragraphs. No markdown, no headers. 3-5 short paragraphs.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You write for a personal finance blog. Return only valid JSON with keys: title, description, body.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1000,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return NextResponse.json(
        { message: "No content from AI" },
        { status: 500 }
      );
    }

    let json: { title?: string; description?: string; body?: string };
    try {
      json = JSON.parse(raw) as { title?: string; description?: string; body?: string };
    } catch {
      return NextResponse.json(
        { message: "Invalid JSON from AI" },
        { status: 500 }
      );
    }

    const title = typeof json.title === "string" ? json.title.trim() : "Untitled";
    const description =
      typeof json.description === "string" ? json.description.trim() : "";
    const body = typeof json.body === "string" ? json.body.trim() : "";

    if (!title || !body) {
      return NextResponse.json(
        { message: "AI did not return title or body" },
        { status: 500 }
      );
    }

    const slug = slugFromTitle(title);

    return NextResponse.json({
      title,
      description: description || `A practical guide about ${topic}.`,
      slug,
      body: body || "",
    });
  } catch (error) {
    console.error("[blog/generate-with-ai]", error);
    return NextResponse.json(
      { message: "Failed to generate content" },
      { status: 500 }
    );
  }
}
