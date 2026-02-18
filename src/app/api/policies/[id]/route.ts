import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const policy = await prisma.policy.findUnique({
    where: { id, deletedAt: null },
    include: {
      author: { select: { id: true, clerkId: true, name: true, email: true, location: true } },
      endorsements: {
        include: { user: { select: { name: true, location: true } } },
        orderBy: { createdAt: "desc" },
        take: 21,
      },
      _count: { select: { endorsements: true, petitionSignatures: true } },
    },
  });

  if (!policy) {
    return NextResponse.json(
      { error: "Policy not found." },
      { status: 404 }
    );
  }

  // Increment view count (fire-and-forget)
  prisma.policy
    .update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    })
    .catch(() => {});

  return NextResponse.json({ policy });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "You must be signed in." },
      { status: 401 }
    );
  }

  const policy = await prisma.policy.findUnique({
    where: { id, deletedAt: null },
    include: { author: { select: { clerkId: true } } },
  });

  if (!policy) {
    return NextResponse.json(
      { error: "Policy not found." },
      { status: 404 }
    );
  }

  if (policy.author.clerkId !== userId) {
    return NextResponse.json(
      { error: "You can only delete your own policies." },
      { status: 403 }
    );
  }

  await prisma.policy.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
