import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

// In-memory rate limiting: IP -> list of request timestamps
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    rateLimitMap.set(ip, recent);
    return true;
  }
  recent.push(now);
  rateLimitMap.set(ip, recent);
  return false;
}

interface AnalysisResult {
  readabilityScore: number;
  readabilityLevel: string;
  potentialConflicts: string[];
  affectedGroups: string[];
  missingElements: string[];
  suggestions: string[];
  summary: string;
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please wait a minute before trying again." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { content, targetLawText } = body;

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Policy content is required." },
        { status: 400 }
      );
    }

    if (content.trim().length < 100) {
      return NextResponse.json(
        { error: "Policy content must be at least 100 characters." },
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

    const targetLawSection =
      targetLawText && typeof targetLawText === "string"
        ? `

The user has also provided existing law text to compare against. Identify any potential conflicts, contradictions, or overlaps between the policy and this existing law:

<existing_law>
${targetLawText.trim()}
</existing_law>`
        : "";

    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `Analyze the following policy text and return your analysis as a JSON object. Do not include any text outside the JSON object.

The JSON must have exactly these fields:
- "readabilityScore": number from 0 to 100 representing the Flesch-Kincaid readability score (higher = easier to read)
- "readabilityLevel": one of "Elementary", "Middle School", "High School", "College", or "Graduate"
- "potentialConflicts": array of strings describing potential conflicts with existing laws or regulations${targetLawText ? ", paying special attention to conflicts with the provided existing law text" : ""}
- "affectedGroups": array of strings identifying stakeholder groups affected by this policy
- "missingElements": array of strings identifying missing policy elements such as budget/funding, implementation timeline, enforcement mechanisms, success metrics, sunset clauses, or oversight provisions
- "suggestions": array of 3 to 5 strings with concrete improvements for clarity and completeness
- "summary": a 2-3 sentence overview of what this policy does and its key implications
${targetLawSection}

<policy>
${content.trim()}
</policy>`,
        },
      ],
    });

    const responseContent = message.content[0];
    if (responseContent.type !== "text") {
      return NextResponse.json(
        { error: "Unexpected response format from AI." },
        { status: 500 }
      );
    }

    let analysis: AnalysisResult;
    try {
      // Strip markdown code fences if present
      let jsonText = responseContent.text.trim();
      if (jsonText.startsWith("```")) {
        jsonText = jsonText
          .replace(/^```(?:json)?\s*\n?/, "")
          .replace(/\n?```\s*$/, "");
      }
      analysis = JSON.parse(jsonText);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse AI analysis. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("Policy analysis error:", error);

    if (error instanceof Anthropic.APIError) {
      if (error.status === 401) {
        return NextResponse.json(
          { error: "Invalid API key. Check server configuration." },
          { status: 500 }
        );
      }
      if (error.status === 429) {
        return NextResponse.json(
          { error: "AI rate limit exceeded. Please wait a moment and try again." },
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
