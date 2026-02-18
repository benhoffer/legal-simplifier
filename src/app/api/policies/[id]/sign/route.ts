import { auth, currentUser } from "@clerk/nextjs/server";
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// ── POST: Sign petition ─────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: policyId } = await params;

  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json(
      { error: "You must be signed in to sign a petition." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { fullName, location } = body;

    if (!fullName || typeof fullName !== "string" || !fullName.trim()) {
      return NextResponse.json(
        { error: "Full name is required." },
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

    // Check if already signed
    const existing = await prisma.petitionSignature.findUnique({
      where: { policyId_userId: { policyId, userId: dbUser.id } },
    });

    if (existing) {
      return NextResponse.json(
        { error: "You have already signed this petition." },
        { status: 400 }
      );
    }

    const verificationToken = randomUUID();

    const signature = await prisma.petitionSignature.create({
      data: {
        policyId,
        userId: dbUser.id,
        fullName: fullName.trim(),
        location: location?.trim() || null,
        emailVerified: false,
        verificationToken,
      },
    });

    // TODO: Replace with Resend email sending
    const verifyUrl = `${request.nextUrl.origin}/api/petitions/verify?token=${verificationToken}`;
    console.log(
      `[Petition Verification] Send email to ${clerkUser?.emailAddresses[0]?.emailAddress ?? "unknown"}:`,
      verifyUrl
    );

    const count = await prisma.petitionSignature.count({
      where: { policyId },
    });

    return NextResponse.json(
      {
        signed: true,
        signatureId: signature.id,
        emailVerified: false,
        count,
        message:
          "Petition signed! Please check your email to verify your signature.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/policies/[id]/sign error:", error);
    return NextResponse.json(
      { error: "Failed to sign petition." },
      { status: 500 }
    );
  }
}

// ── GET: List signatures ────────────────────────────────────────────────────

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

    const [signatures, count] = await Promise.all([
      prisma.petitionSignature.findMany({
        where: { policyId, emailVerified: true },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          fullName: true,
          location: true,
          createdAt: true,
        },
        take: 50,
      }),
      prisma.petitionSignature.count({
        where: { policyId, emailVerified: true },
      }),
    ]);

    return NextResponse.json({ signatures, count });
  } catch (error) {
    console.error("GET /api/policies/[id]/sign error:", error);
    return NextResponse.json(
      { error: "Failed to load signatures." },
      { status: 500 }
    );
  }
}
