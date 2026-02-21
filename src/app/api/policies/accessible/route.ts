import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const dbUser = await prisma.user.findUnique({ where: { clerkId } });
    if (!dbUser) {
      return NextResponse.json({ policies: [] });
    }

    // Get user's memberships + parent orgs
    const memberships = await prisma.organizationMember.findMany({
      where: { userId: dbUser.id },
      include: {
        organization: { select: { id: true, parentId: true, name: true } },
      },
    });

    const orgIds = new Set<string>();
    for (const m of memberships) {
      orgIds.add(m.organizationId);
      if (m.organization.parentId) orgIds.add(m.organization.parentId);
    }

    if (orgIds.size === 0) {
      return NextResponse.json({ policies: [] });
    }

    const policies = await prisma.policy.findMany({
      where: {
        published: true,
        deletedAt: null,
        organizationId: { in: Array.from(orgIds) },
      },
      orderBy: { publishedAt: "desc" },
      take: 200,
      select: {
        id: true,
        title: true,
        category: true,
        organizationId: true,
        organization: { select: { name: true } },
      },
    });

    return NextResponse.json({ policies });
  } catch (error) {
    console.error("GET /api/policies/accessible error:", error);
    return NextResponse.json(
      { error: "Failed to load policies." },
      { status: 500 }
    );
  }
}
