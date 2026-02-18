import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: commentId } = await params;

  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json(
      { error: "You must be signed in to delete a comment." },
      { status: 401 }
    );
  }

  try {
    const comment = await prisma.comment.findFirst({
      where: { id: commentId, deletedAt: null },
      include: {
        user: { select: { clerkId: true } },
      },
    });

    if (!comment) {
      return NextResponse.json(
        { error: "Comment not found." },
        { status: 404 }
      );
    }

    if (comment.user.clerkId !== clerkId) {
      return NextResponse.json(
        { error: "You can only delete your own comments." },
        { status: 403 }
      );
    }

    await prisma.comment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("DELETE /api/comments/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete comment." },
      { status: 500 }
    );
  }
}
