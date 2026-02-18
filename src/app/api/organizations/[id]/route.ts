import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// ── GET: Organization details ───────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        _count: {
          select: { members: true, endorsements: true, policies: true },
        },
        policies: {
          where: { published: true, deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            title: true,
            category: true,
            createdAt: true,
          },
        },
        endorsements: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            policy: {
              select: { id: true, title: true, category: true },
            },
          },
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found." },
        { status: 404 }
      );
    }

    // Check if current user is a member
    let membership = null;
    try {
      const { userId: clerkId } = await auth();
      if (clerkId) {
        const dbUser = await prisma.user.findUnique({ where: { clerkId } });
        if (dbUser) {
          membership = await prisma.organizationMember.findUnique({
            where: {
              userId_organizationId: {
                userId: dbUser.id,
                organizationId: id,
              },
            },
            select: { role: true },
          });
        }
      }
    } catch {
      // Auth not available, that's fine
    }

    return NextResponse.json({ organization, membership });
  } catch (error) {
    console.error("GET /api/organizations/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to load organization." },
      { status: 500 }
    );
  }
}

// ── PATCH: Update organization ──────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json(
      { error: "You must be signed in." },
      { status: 401 }
    );
  }

  try {
    // Verify admin
    const dbUser = await prisma.user.findUnique({ where: { clerkId } });
    if (!dbUser) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const membership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: { userId: dbUser.id, organizationId: id },
      },
    });

    if (!membership || membership.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can update the organization." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description, website } = body;

    const data: Record<string, string | null> = {};
    if (name !== undefined) {
      if (!name || !name.trim()) {
        return NextResponse.json(
          { error: "Name cannot be empty." },
          { status: 400 }
        );
      }
      data.name = name.trim();
    }
    if (description !== undefined)
      data.description = description?.trim() || null;
    if (website !== undefined) data.website = website?.trim() || null;

    const organization = await prisma.organization.update({
      where: { id },
      data,
      include: {
        _count: {
          select: { members: true, endorsements: true, policies: true },
        },
      },
    });

    return NextResponse.json({ organization });
  } catch (error) {
    console.error("PATCH /api/organizations/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update organization." },
      { status: 500 }
    );
  }
}
