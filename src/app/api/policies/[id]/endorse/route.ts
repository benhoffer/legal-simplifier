import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// ── POST: Add endorsement ────────────────────────────────────────────────────

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: policyId } = await params;

  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json(
      { error: "You must be signed in to endorse." },
      { status: 401 }
    );
  }

  try {
    const policy = await prisma.policy.findUnique({
      where: { id: policyId, deletedAt: null, published: true },
    });

    if (!policy) {
      return NextResponse.json(
        { error: "Policy not found." },
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

    // Check if already endorsed (personal)
    const existing = await prisma.endorsement.findFirst({
      where: { userId: dbUser.id, policyId, organizationId: null },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Already endorsed." },
        { status: 400 }
      );
    }

    // Create endorsement and get count in a transaction
    const [, count] = await prisma.$transaction([
      prisma.endorsement.create({
        data: { userId: dbUser.id, policyId, type: "individual" },
      }),
      prisma.endorsement.count({ where: { policyId } }),
    ]);

    // count is taken before the create commits within the same transaction,
    // so add 1 for the just-created record
    return NextResponse.json(
      { endorsed: true, count: count + 1 },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/policies/[id]/endorse error:", error);
    return NextResponse.json(
      { error: "Failed to endorse policy." },
      { status: 500 }
    );
  }
}

// ── DELETE: Remove endorsement ───────────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: policyId } = await params;

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

    const existing = await prisma.endorsement.findFirst({
      where: { userId: dbUser.id, policyId, organizationId: null },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "You have not endorsed this policy." },
        { status: 404 }
      );
    }

    // Delete and count in a transaction
    const [, count] = await prisma.$transaction([
      prisma.endorsement.delete({ where: { id: existing.id } }),
      prisma.endorsement.count({ where: { policyId } }),
    ]);

    // count is taken before the delete commits, so subtract 1
    return NextResponse.json({ endorsed: false, count: count - 1 });
  } catch (error) {
    console.error("DELETE /api/policies/[id]/endorse error:", error);
    return NextResponse.json(
      { error: "Failed to remove endorsement." },
      { status: 500 }
    );
  }
}

// ── GET: List endorsements ───────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: policyId } = await params;

  try {
    const policy = await prisma.policy.findUnique({
      where: { id: policyId, deletedAt: null },
      select: { id: true },
    });

    if (!policy) {
      return NextResponse.json(
        { error: "Policy not found." },
        { status: 404 }
      );
    }

    const endorsements = await prisma.endorsement.findMany({
      where: { policyId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        createdAt: true,
        user: { select: { name: true, location: true } },
        organization: { select: { id: true, name: true, verified: true } },
      },
    });

    return NextResponse.json({ endorsements });
  } catch (error) {
    console.error("GET /api/policies/[id]/endorse error:", error);
    return NextResponse.json(
      { error: "Failed to load endorsements." },
      { status: 500 }
    );
  }
}
