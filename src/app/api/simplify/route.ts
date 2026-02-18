import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const READING_LEVEL_PROMPTS: Record<string, string> = {
  "5th grade":
    "Rewrite this so a 5th grader (age 10-11) can understand it. Use short sentences, simple words, and explain any concept that a child might not know. Avoid jargon entirely.",
  "high school":
    "Rewrite this for a high school student (age 14-18). Use clear, straightforward language. Define legal or technical terms briefly in parentheses when they first appear. Keep sentences concise.",
  college:
    "Rewrite this for a college-educated reader who is not a lawyer. Preserve important nuances and qualifications, but replace legal jargon with plain English equivalents. Use clear paragraph structure.",
};

export async function POST(request: NextRequest) {
  try {
    const { text, readingLevel } = await request.json();

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Please provide legal text to simplify." },
        { status: 400 }
      );
    }

    if (!readingLevel || !READING_LEVEL_PROMPTS[readingLevel]) {
      return NextResponse.json(
        { error: "Please select a valid reading level." },
        { status: 400 }
      );
    }

    if (text.length > 50000) {
      return NextResponse.json(
        { error: "Text is too long. Please limit to 50,000 characters." },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Server configuration error: missing API key." },
        { status: 500 }
      );
    }

    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `${READING_LEVEL_PROMPTS[readingLevel]}

Preserve the overall structure (paragraphs, sections, numbered lists) of the original where possible. Do not add information that is not in the original. Do not provide legal advice or commentary — only simplify the language.

Here is the legal text to simplify:

${text}`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      return NextResponse.json(
        { error: "Unexpected response format from AI." },
        { status: 500 }
      );
    }

    return NextResponse.json({ simplified: content.text });
  } catch (error) {
    console.error("Simplify API error:", error);

    if (error instanceof Anthropic.APIError) {
      if (error.status === 401) {
        return NextResponse.json(
          { error: "Invalid API key. Check server configuration." },
          { status: 500 }
        );
      }
      if (error.status === 429) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Please wait a moment and try again." },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: `AI service error: ${error.message}` },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
