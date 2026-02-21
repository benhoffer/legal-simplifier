import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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

    // Load the policy
    const policy = await prisma.policy.findUnique({
      where: { id: policyId, deletedAt: null, published: true },
      select: { id: true, title: true, content: true, organizationId: true },
    });

    if (!policy) {
      return NextResponse.json({ error: "Policy not found." }, { status: 404 });
    }

    // Verify the user has access through org membership
    if (policy.organizationId) {
      const memberships = await prisma.organizationMember.findMany({
        where: { userId: dbUser.id },
        include: { organization: { select: { id: true, parentId: true } } },
      });

      const accessibleOrgIds = new Set<string>();
      for (const m of memberships) {
        accessibleOrgIds.add(m.organizationId);
        if (m.organization.parentId) accessibleOrgIds.add(m.organization.parentId);
      }

      if (!accessibleOrgIds.has(policy.organizationId)) {
        return NextResponse.json(
          { error: "You don't have access to this policy." },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const { question } = body as { question: string };

    if (!question || typeof question !== "string" || !question.trim()) {
      return NextResponse.json(
        { error: "A question is required." },
        { status: 400 }
      );
    }

    if (question.trim().length > 1000) {
      return NextResponse.json(
        { error: "Question must be 1000 characters or fewer." },
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
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `You are analyzing a specific policy document. Answer the user's question based on the content of this policy. Be specific and cite relevant sections or provisions when possible. If the question cannot be answered from the policy text alone, say so clearly.

<policy title="${policy.title}">
${policy.content}
</policy>

User's question: ${question.trim()}`,
        },
      ],
    });

    const responseContent = message.content[0];
    if (responseContent.type !== "text") {
      return NextResponse.json(
        { error: "Unexpected response from AI." },
        { status: 500 }
      );
    }

    return NextResponse.json({ answer: responseContent.text });
  } catch (error) {
    console.error("POST /api/policies/[id]/ask error:", error);

    if (error instanceof Anthropic.APIError) {
      if (error.status === 429) {
        return NextResponse.json(
          { error: "AI rate limit exceeded. Please wait and try again." },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
