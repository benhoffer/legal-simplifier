import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// ── GET: List members ───────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orgId } = await params;

  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true },
    });

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found." },
        { status: 404 }
      );
    }

    const members = await prisma.organizationMember.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { id: true, name: true, email: true, location: true } },
      },
    });

    return NextResponse.json({ members });
  } catch (error) {
    console.error("GET /api/organizations/[id]/members error:", error);
    return NextResponse.json(
      { error: "Failed to load members." },
      { status: 500 }
    );
  }
}

// ── POST: Request access to organization ────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orgId } = await params;

  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json(
      { error: "You must be signed in to request access." },
      { status: 401 }
    );
  }

  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true },
    });

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found." },
        { status: 404 }
      );
    }

    // Find or create user
    const clerkUser = await currentUser();
    let dbUser = await prisma.user.findUnique({ where: { clerkId } });

    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          clerkId,
          email: clerkUser?.emailAddresses[0]?.emailAddress ?? "",
          name:
            clerkUser?.firstName && clerkUser?.lastName
              ? `${clerkUser.firstName} ${clerkUser.lastName}`
              : clerkUser?.firstName ?? null,
        },
      });
    }

    // Check if already a member
    const existing = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: { userId: dbUser.id, organizationId: orgId },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "You are already a member." },
        { status: 400 }
      );
    }

    // Check if already has a pending request
    const existingRequest = await prisma.accessRequest.findUnique({
      where: {
        userId_organizationId: { userId: dbUser.id, organizationId: orgId },
      },
    });

    if (existingRequest) {
      if (existingRequest.status === "pending") {
        return NextResponse.json(
          { error: "You already have a pending request." },
          { status: 400 }
        );
      }
      // If previously denied, allow re-requesting by updating it
      const body = await request.json().catch(() => ({}));
      const updated = await prisma.accessRequest.update({
        where: { id: existingRequest.id },
        data: {
          status: "pending",
          message: body.message?.trim() || null,
          reviewedAt: null,
          reviewedById: null,
        },
      });
      return NextResponse.json({ requested: true, request: updated }, { status: 202 });
    }

    const body = await request.json().catch(() => ({}));
    const accessRequest = await prisma.accessRequest.create({
      data: {
        userId: dbUser.id,
        organizationId: orgId,
        status: "pending",
        message: body.message?.trim() || null,
      },
    });

    return NextResponse.json({ requested: true, request: accessRequest }, { status: 202 });
  } catch (error) {
    console.error("POST /api/organizations/[id]/members error:", error);
    return NextResponse.json(
      { error: "Failed to request access." },
      { status: 500 }
    );
  }
}

// ── DELETE: Leave or remove member ──────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orgId } = await params;

  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json(
      { error: "You must be signed in." },
      { status: 401 }
    );
  }

  try {
    const dbUser = await prisma.user.findUnique({ where: { clerkId } });
    if (!dbUser) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 }
      );
    }

    // Check if removing self or someone else
    let targetUserId = dbUser.id;

    const url = new URL(request.url);
    const removeUserId = url.searchParams.get("userId");

    if (removeUserId && removeUserId !== dbUser.id) {
      // Removing someone else — must be admin
      const adminMembership = await prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: dbUser.id,
            organizationId: orgId,
          },
        },
      });

      if (!adminMembership || adminMembership.role !== "admin") {
        return NextResponse.json(
          { error: "Only admins can remove members." },
          { status: 403 }
        );
      }

      targetUserId = removeUserId;
    }

    const membership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: targetUserId,
          organizationId: orgId,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Membership not found." },
        { status: 404 }
      );
    }

    // Prevent removing the last admin
    if (membership.role === "admin") {
      const adminCount = await prisma.organizationMember.count({
        where: { organizationId: orgId, role: "admin" },
      });

      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot remove the last admin." },
          { status: 400 }
        );
      }
    }

    await prisma.organizationMember.delete({
      where: { id: membership.id },
    });

    return NextResponse.json({ removed: true });
  } catch (error) {
    console.error("DELETE /api/organizations/[id]/members error:", error);
    return NextResponse.json(
      { error: "Failed to remove member." },
      { status: 500 }
    );
  }
}
