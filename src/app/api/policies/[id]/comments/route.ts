import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// ── POST: Create comment ────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: policyId } = await params;

  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json(
      { error: "You must be signed in to comment." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { content, parentId } = body;

    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { error: "Comment content is required." },
        { status: 400 }
      );
    }

    if (content.trim().length > 2000) {
      return NextResponse.json(
        { error: "Comment must be 2000 characters or less." },
        { status: 400 }
      );
    }

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

    // If replying, verify parent comment exists and belongs to same policy
    if (parentId) {
      const parent = await prisma.comment.findFirst({
        where: { id: parentId, policyId, deletedAt: null },
      });
      if (!parent) {
        return NextResponse.json(
          { error: "Parent comment not found." },
          { status: 404 }
        );
      }
      // Only allow 1 level of nesting
      if (parent.parentId) {
        return NextResponse.json(
          { error: "Cannot reply to a reply." },
          { status: 400 }
        );
      }
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

    const comment = await prisma.comment.create({
      data: {
        policyId,
        userId: dbUser.id,
        content: content.trim(),
        parentId: parentId || null,
      },
      include: {
        user: { select: { id: true, name: true, clerkId: true } },
      },
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error("POST /api/policies/[id]/comments error:", error);
    return NextResponse.json(
      { error: "Failed to create comment." },
      { status: 500 }
    );
  }
}

// ── GET: List comments ──────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: policyId } = await params;
  const sort = request.nextUrl.searchParams.get("sort") || "newest";
  const cursor = request.nextUrl.searchParams.get("cursor");

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

    // Determine sort order for top-level comments
    let orderBy: Record<string, string>;
    if (sort === "popular" || sort === "controversial") {
      // Fetch all then sort in JS for these modes
      orderBy = { createdAt: "desc" };
    } else {
      orderBy = { createdAt: "desc" };
    }

    const take = 20;

    const comments = await prisma.comment.findMany({
      where: {
        policyId,
        parentId: null, // top-level only
        deletedAt: null,
      },
      orderBy,
      take: sort === "popular" || sort === "controversial" ? 200 : take + 1,
      ...(cursor && sort === "newest"
        ? { cursor: { id: cursor }, skip: 1 }
        : {}),
      include: {
        user: { select: { id: true, name: true, clerkId: true } },
        replies: {
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
          include: {
            user: { select: { id: true, name: true, clerkId: true } },
          },
        },
      },
    });

    // Also include soft-deleted comments that have non-deleted replies
    const deletedWithReplies = await prisma.comment.findMany({
      where: {
        policyId,
        parentId: null,
        deletedAt: { not: null },
        replies: { some: { deletedAt: null } },
      },
      orderBy,
      include: {
        user: { select: { id: true, name: true, clerkId: true } },
        replies: {
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
          include: {
            user: { select: { id: true, name: true, clerkId: true } },
          },
        },
      },
    });

    let allComments = [...comments, ...deletedWithReplies];

    // Deduplicate
    const seen = new Set<string>();
    allComments = allComments.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });

    // Sort
    if (sort === "popular") {
      allComments.sort(
        (a, b) => b.upvotes - b.downvotes - (a.upvotes - a.downvotes)
      );
    } else if (sort === "controversial") {
      // High total votes + close ratio = more controversial
      const controversyScore = (c: { upvotes: number; downvotes: number }) => {
        const total = c.upvotes + c.downvotes;
        if (total === 0) return 0;
        return total / (Math.abs(c.upvotes - c.downvotes) + 1);
      };
      allComments.sort(
        (a, b) => controversyScore(b) - controversyScore(a)
      );
    }

    // Paginate for popular/controversial
    let hasMore = false;
    if (sort === "popular" || sort === "controversial") {
      hasMore = allComments.length > take;
      allComments = allComments.slice(0, take);
    } else {
      hasMore = allComments.length > take;
      if (hasMore) allComments = allComments.slice(0, take);
    }

    const nextCursor = hasMore
      ? allComments[allComments.length - 1]?.id
      : null;

    const totalCount = await prisma.comment.count({
      where: { policyId, deletedAt: null },
    });

    return NextResponse.json({
      comments: allComments,
      nextCursor,
      hasMore,
      totalCount,
    });
  } catch (error) {
    console.error("GET /api/policies/[id]/comments error:", error);
    return NextResponse.json(
      { error: "Failed to load comments." },
      { status: 500 }
    );
  }
}
