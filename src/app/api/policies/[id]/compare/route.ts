import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface ComparisonResult {
  additions: string[];
  removals: string[];
  changes: string[];
  summary: string;
  impactAnalysis: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: policyId } = await params;

  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const dbUser = await prisma.user.findUnique({ where: { clerkId } });
    if (!dbUser) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    // Load the primary policy
    const policy = await prisma.policy.findUnique({
      where: { id: policyId, deletedAt: null, published: true },
      select: {
        id: true,
        title: true,
        content: true,
        targetLawText: true,
        targetLawName: true,
        organizationId: true,
      },
    });

    if (!policy) {
      return NextResponse.json({ error: "Policy not found." }, { status: 404 });
    }

    // Determine the user's accessible org IDs (memberships + parent orgs)
    const memberships = await prisma.organizationMember.findMany({
      where: { userId: dbUser.id },
      include: { organization: { select: { id: true, parentId: true } } },
    });

    const accessibleOrgIds = new Set<string>();
    for (const m of memberships) {
      accessibleOrgIds.add(m.organizationId);
      if (m.organization.parentId) accessibleOrgIds.add(m.organization.parentId);
    }

    // Verify user can access the primary policy
    if (policy.organizationId && !accessibleOrgIds.has(policy.organizationId)) {
      return NextResponse.json(
        { error: "You don't have access to this policy." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { comparePolicyId } = body as { comparePolicyId?: string };

    let lawText: string;
    let lawLabel: string;

    if (comparePolicyId) {
      // Load the comparison policy from the DB and check access
      const comparePolicy = await prisma.policy.findUnique({
        where: { id: comparePolicyId, deletedAt: null, published: true },
        select: { id: true, title: true, content: true, organizationId: true },
      });

      if (!comparePolicy) {
        return NextResponse.json(
          { error: "Comparison policy not found." },
          { status: 404 }
        );
      }

      if (
        comparePolicy.organizationId &&
        !accessibleOrgIds.has(comparePolicy.organizationId)
      ) {
        return NextResponse.json(
          { error: "You don't have access to the comparison policy." },
          { status: 403 }
        );
      }

      lawText = comparePolicy.content;
      lawLabel = comparePolicy.title;
    } else if (policy.targetLawText) {
      // Fall back to the stored reference text (backward compat)
      lawText = policy.targetLawText;
      lawLabel = policy.targetLawName || "Reference Law";
    } else {
      return NextResponse.json(
        { error: "No comparison target specified." },
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
          content: `Compare the following existing law text with a proposed policy. Analyze the differences and return your analysis as a JSON object. Do not include any text outside the JSON object.

The JSON must have exactly these fields:
- "additions": array of strings describing key provisions, rights, or requirements that the proposed policy ADDS that are not in the existing law
- "removals": array of strings describing provisions, rights, or requirements from the existing law that the proposed policy REMOVES or eliminates
- "changes": array of strings describing provisions that exist in both but are MODIFIED by the proposed policy (describe what changed)
- "summary": a 2-3 sentence overview of the most significant differences between the existing law and the proposed policy
- "impactAnalysis": a paragraph (3-5 sentences) analyzing the overall impact of these changes — who benefits, who is affected, and what the practical consequences would be

<existing_law>
${lawText}
</existing_law>

<proposed_policy>
${policy.content}
</proposed_policy>`,
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

    let comparison: ComparisonResult;
    try {
      let jsonText = responseContent.text.trim();
      if (jsonText.startsWith("```")) {
        jsonText = jsonText
          .replace(/^```(?:json)?\s*\n?/, "")
          .replace(/\n?```\s*$/, "");
      }
      comparison = JSON.parse(jsonText);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse AI comparison. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ comparison, lawLabel });
  } catch (error) {
    console.error("POST /api/policies/[id]/compare error:", error);

    if (error instanceof Anthropic.APIError) {
      if (error.status === 429) {
        return NextResponse.json(
          { error: "AI rate limit exceeded. Please wait and try again." },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: `AI service error: ${error.message}` },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
