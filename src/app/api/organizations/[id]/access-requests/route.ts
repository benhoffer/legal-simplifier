import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// ── GET: List access requests (admin only) ───────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orgId } = await params;

  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const dbUser = await prisma.user.findUnique({ where: { clerkId } });
    if (!dbUser) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    // Verify requester is an admin of this org
    const membership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: { userId: dbUser.id, organizationId: orgId },
      },
    });

    if (!membership || membership.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can view access requests." },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "pending";

    const requests = await prisma.accessRequest.findMany({
      where: { organizationId: orgId, status },
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error("GET /api/organizations/[id]/access-requests error:", error);
    return NextResponse.json(
      { error: "Failed to load access requests." },
      { status: 500 }
    );
  }
}

// ── PATCH: Approve or deny a request (admin only) ───────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orgId } = await params;

  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const dbUser = await prisma.user.findUnique({ where: { clerkId } });
    if (!dbUser) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    // Verify requester is an admin
    const membership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: { userId: dbUser.id, organizationId: orgId },
      },
    });

    if (!membership || membership.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can review access requests." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { requestId, action } = body as {
      requestId: string;
      action: "approve" | "deny";
    };

    if (!requestId || !["approve", "deny"].includes(action)) {
      return NextResponse.json(
        { error: "requestId and action (approve|deny) are required." },
        { status: 400 }
      );
    }

    const accessRequest = await prisma.accessRequest.findUnique({
      where: { id: requestId },
    });

    if (!accessRequest || accessRequest.organizationId !== orgId) {
      return NextResponse.json(
        { error: "Access request not found." },
        { status: 404 }
      );
    }

    if (accessRequest.status !== "pending") {
      return NextResponse.json(
        { error: "This request has already been reviewed." },
        { status: 400 }
      );
    }

    if (action === "approve") {
      // Create the membership and update the request in a transaction
      await prisma.$transaction([
        prisma.organizationMember.create({
          data: {
            userId: accessRequest.userId,
            organizationId: orgId,
            role: "member",
          },
        }),
        prisma.accessRequest.update({
          where: { id: requestId },
          data: {
            status: "approved",
            reviewedById: dbUser.id,
            reviewedAt: new Date(),
          },
        }),
      ]);
    } else {
      await prisma.accessRequest.update({
        where: { id: requestId },
        data: {
          status: "denied",
          reviewedById: dbUser.id,
          reviewedAt: new Date(),
        },
      });
    }

    return NextResponse.json({ success: true, action });
  } catch (error) {
    console.error("PATCH /api/organizations/[id]/access-requests error:", error);
    return NextResponse.json(
      { error: "Failed to review access request." },
      { status: 500 }
    );
  }
}
