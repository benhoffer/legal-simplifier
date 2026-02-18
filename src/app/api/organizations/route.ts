import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// ── GET: List organizations ─────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get("search") || "";
  const membership = request.nextUrl.searchParams.get("membership"); // "admin" | "member" | null

  try {
    // If filtering by membership, require auth
    if (membership) {
      const { userId: clerkId } = await auth();
      if (!clerkId) {
        return NextResponse.json(
          { error: "Authentication required." },
          { status: 401 }
        );
      }

      const dbUser = await prisma.user.findUnique({ where: { clerkId } });
      if (!dbUser) {
        return NextResponse.json({ organizations: [] });
      }

      const memberships = await prisma.organizationMember.findMany({
        where: {
          userId: dbUser.id,
          ...(membership === "admin" ? { role: "admin" } : {}),
        },
        include: {
          organization: {
            include: {
              _count: {
                select: {
                  members: true,
                  endorsements: true,
                  policies: true,
                },
              },
            },
          },
        },
      });

      return NextResponse.json({
        organizations: memberships.map((m) => ({
          ...m.organization,
          role: m.role,
        })),
      });
    }

    // Public listing
    const organizations = await prisma.organization.findMany({
      where: search
        ? { name: { contains: search, mode: "insensitive" } }
        : {},
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            members: true,
            endorsements: true,
            policies: true,
          },
        },
      },
    });

    return NextResponse.json({ organizations });
  } catch (error) {
    console.error("GET /api/organizations error:", error);
    return NextResponse.json(
      { error: "Failed to load organizations." },
      { status: 500 }
    );
  }
}

// ── POST: Create organization ───────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json(
      { error: "You must be signed in to create an organization." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { name, description, website } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Organization name is required." },
        { status: 400 }
      );
    }

    if (name.trim().length > 100) {
      return NextResponse.json(
        { error: "Name must be 100 characters or less." },
        { status: 400 }
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

    // Create org with current user as admin
    const organization = await prisma.organization.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        website: website?.trim() || null,
        members: {
          create: {
            userId: dbUser.id,
            role: "admin",
          },
        },
      },
      include: {
        _count: {
          select: { members: true, endorsements: true, policies: true },
        },
      },
    });

    return NextResponse.json({ organization }, { status: 201 });
  } catch (error) {
    console.error("POST /api/organizations error:", error);
    return NextResponse.json(
      { error: "Failed to create organization." },
      { status: 500 }
    );
  }
}
