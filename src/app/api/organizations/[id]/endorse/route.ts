import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// ── POST: Endorse policy as organization ────────────────────────────────────

export async function POST(
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
    const body = await request.json();
    const { policyId } = body;

    if (!policyId) {
      return NextResponse.json(
        { error: "policyId is required." },
        { status: 400 }
      );
    }

    // Verify user is admin of this org
    const dbUser = await prisma.user.findUnique({ where: { clerkId } });
    if (!dbUser) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 }
      );
    }

    const membership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: { userId: dbUser.id, organizationId: orgId },
      },
    });

    if (!membership || membership.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can endorse on behalf of an organization." },
        { status: 403 }
      );
    }

    // Verify policy exists
    const policy = await prisma.policy.findUnique({
      where: { id: policyId, deletedAt: null, published: true },
      select: { id: true },
    });

    if (!policy) {
      return NextResponse.json(
        { error: "Policy not found." },
        { status: 404 }
      );
    }

    // Check if org already endorsed
    const existing = await prisma.endorsement.findFirst({
      where: { organizationId: orgId, policyId },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Organization has already endorsed this policy." },
        { status: 400 }
      );
    }

    await prisma.endorsement.create({
      data: {
        policyId,
        organizationId: orgId,
        userId: null,
        type: "organization",
      },
    });

    const count = await prisma.endorsement.count({ where: { policyId } });

    return NextResponse.json({ endorsed: true, count }, { status: 201 });
  } catch (error) {
    console.error("POST /api/organizations/[id]/endorse error:", error);
    return NextResponse.json(
      { error: "Failed to endorse." },
      { status: 500 }
    );
  }
}

// ── DELETE: Remove organization endorsement ─────────────────────────────────

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
    const body = await request.json().catch(() => ({}));
    const { policyId } = body as { policyId?: string };

    if (!policyId) {
      return NextResponse.json(
        { error: "policyId is required." },
        { status: 400 }
      );
    }

    // Verify admin
    const dbUser = await prisma.user.findUnique({ where: { clerkId } });
    if (!dbUser) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 }
      );
    }

    const membership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: { userId: dbUser.id, organizationId: orgId },
      },
    });

    if (!membership || membership.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can remove endorsements." },
        { status: 403 }
      );
    }

    const endorsement = await prisma.endorsement.findFirst({
      where: { organizationId: orgId, policyId },
    });

    if (!endorsement) {
      return NextResponse.json(
        { error: "Endorsement not found." },
        { status: 404 }
      );
    }

    await prisma.endorsement.delete({ where: { id: endorsement.id } });

    const count = await prisma.endorsement.count({ where: { policyId } });

    return NextResponse.json({ endorsed: false, count });
  } catch (error) {
    console.error("DELETE /api/organizations/[id]/endorse error:", error);
    return NextResponse.json(
      { error: "Failed to remove endorsement." },
      { status: 500 }
    );
  }
}
