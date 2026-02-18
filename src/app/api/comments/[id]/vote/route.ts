import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: commentId } = await params;

  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json(
      { error: "You must be signed in to vote." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { vote } = body;

    if (vote !== "up" && vote !== "down") {
      return NextResponse.json(
        { error: "Vote must be 'up' or 'down'." },
        { status: 400 }
      );
    }

    const comment = await prisma.comment.findFirst({
      where: { id: commentId, deletedAt: null },
    });

    if (!comment) {
      return NextResponse.json(
        { error: "Comment not found." },
        { status: 404 }
      );
    }

    const updated = await prisma.comment.update({
      where: { id: commentId },
      data:
        vote === "up"
          ? { upvotes: { increment: 1 } }
          : { downvotes: { increment: 1 } },
      select: { upvotes: true, downvotes: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("POST /api/comments/[id]/vote error:", error);
    return NextResponse.json(
      { error: "Failed to vote." },
      { status: 500 }
    );
  }
}
