import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ policies: [] });
    }

    const dbUser = await prisma.user.findUnique({ where: { clerkId } });
    if (!dbUser) {
      return NextResponse.json({ policies: [] });
    }

    // Resolve accessible org IDs (user's orgs + parent orgs)
    const memberships = await prisma.organizationMember.findMany({
      where: { userId: dbUser.id },
      include: { organization: { select: { id: true, parentId: true } } },
    });

    const orgIds = new Set<string>();
    for (const m of memberships) {
      orgIds.add(m.organizationId);
      if (m.organization.parentId) orgIds.add(m.organization.parentId);
    }

    const policies = await prisma.policy.findMany({
      where: {
        published: true,
        deletedAt: null,
        organizationId: orgIds.size > 0 ? { in: Array.from(orgIds) } : undefined,
      },
      orderBy: { publishedAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        summary: true,
        category: true,
        jurisdiction: true,
        publishedAt: true,
        viewCount: true,
        author: { select: { name: true, location: true } },
        organization: { select: { name: true } },
        _count: { select: { endorsements: true, petitionSignatures: true } },
      },
    });

    return NextResponse.json({ policies });
  } catch (error) {
    console.error("GET /api/policies error:", error);
    return NextResponse.json(
      { error: "Failed to load policies." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "You must be signed in to publish a policy." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      title,
      content,
      organizationId,
      targetLawName,
      targetLawText,
      analysisResults,
    } = body;

    // --- Validation ---
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        { error: "Title is required." },
        { status: 400 }
      );
    }

    if (title.trim().length > 200) {
      return NextResponse.json(
        { error: "Title must be 200 characters or fewer." },
        { status: 400 }
      );
    }

    if (
      !content ||
      typeof content !== "string" ||
      content.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "Policy content is required." },
        { status: 400 }
      );
    }

    if (content.trim().length > 50000) {
      return NextResponse.json(
        { error: "Content must be 50,000 characters or fewer." },
        { status: 400 }
      );
    }

    // --- Find or create user ---
    const clerkUser = await currentUser();
    let dbUser = await prisma.user.findUnique({ where: { clerkId: userId } });

    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          clerkId: userId,
          email: clerkUser?.emailAddresses[0]?.emailAddress ?? "",
          name:
            clerkUser?.firstName && clerkUser?.lastName
              ? `${clerkUser.firstName} ${clerkUser.lastName}`
              : clerkUser?.firstName ?? null,
        },
      });
    }

    // --- Validate org membership and resolve jurisdiction ---
    let resolvedOrgId: string | null = null;
    let resolvedJurisdiction: string | null = null;

    if (organizationId && typeof organizationId === "string") {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true },
      });

      if (!org) {
        return NextResponse.json(
          { error: "Organization not found." },
          { status: 404 }
        );
      }

      const membership = await prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: { userId: dbUser.id, organizationId },
        },
      });

      if (!membership) {
        return NextResponse.json(
          { error: "You are not a member of this organization." },
          { status: 403 }
        );
      }

      resolvedOrgId = org.id;
      resolvedJurisdiction = org.name;
    }

    // --- Create policy ---
    const now = new Date();

    const policy = await prisma.policy.create({
      data: {
        title: title.trim(),
        content: content.trim(),
        category: analysisResults?.category?.trim() || null,
        jurisdiction: resolvedJurisdiction,
        organizationId: resolvedOrgId,
        targetLawName: targetLawName?.trim() || null,
        targetLawText: targetLawText?.trim() || null,
        summary: analysisResults?.summary?.trim() || null,
        readabilityScore: analysisResults?.readabilityScore ?? null,
        potentialConflicts: Array.isArray(analysisResults?.potentialConflicts)
          ? analysisResults.potentialConflicts.join("\n")
          : null,
        affectedGroups: Array.isArray(analysisResults?.affectedGroups)
          ? analysisResults.affectedGroups.join(", ")
          : null,
        published: true,
        publishedAt: now,
        authorId: dbUser.id,
      },
      select: {
        id: true,
        title: true,
      },
    });

    return NextResponse.json({ policy }, { status: 201 });
  } catch (error) {
    console.error("POST /api/policies error:", error);
    return NextResponse.json(
      { error: "Failed to create policy." },
      { status: 500 }
    );
  }
}
