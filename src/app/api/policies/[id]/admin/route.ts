import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
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
    const policy = await prisma.policy.findUnique({
      where: { id: policyId, deletedAt: null },
      include: {
        author: { select: { clerkId: true, name: true } },
        _count: {
          select: {
            endorsements: true,
            petitionSignatures: true,
            comments: true,
          },
        },
      },
    });

    if (!policy) {
      return NextResponse.json(
        { error: "Policy not found." },
        { status: 404 }
      );
    }

    if (policy.author.clerkId !== clerkId) {
      return NextResponse.json(
        { error: "Only the policy author can access the admin dashboard." },
        { status: 403 }
      );
    }

    // Endorsement breakdown
    const [individualEndorsements, orgEndorsements] = await Promise.all([
      prisma.endorsement.count({
        where: { policyId, type: "individual" },
      }),
      prisma.endorsement.count({
        where: { policyId, type: "organization" },
      }),
    ]);

    // Verified vs total signatures
    const [verifiedSignatures, totalSignatures] = await Promise.all([
      prisma.petitionSignature.count({
        where: { policyId, emailVerified: true },
      }),
      prisma.petitionSignature.count({
        where: { policyId },
      }),
    ]);

    // Signatures over time (group by day)
    const signatures = await prisma.petitionSignature.findMany({
      where: { policyId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });

    const signaturesByDay: Record<string, number> = {};
    for (const s of signatures) {
      const day = s.createdAt.toISOString().slice(0, 10);
      signaturesByDay[day] = (signaturesByDay[day] || 0) + 1;
    }

    // Cumulative signatures
    const signatureTimeline: { date: string; total: number }[] = [];
    let cumulative = 0;
    for (const [date, count] of Object.entries(signaturesByDay)) {
      cumulative += count;
      signatureTimeline.push({ date, total: cumulative });
    }

    // Endorsements over time
    const endorsements = await prisma.endorsement.findMany({
      where: { policyId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, type: true },
    });

    const endorsementsByDay: Record<string, { individual: number; organization: number }> = {};
    for (const e of endorsements) {
      const day = e.createdAt.toISOString().slice(0, 10);
      if (!endorsementsByDay[day]) {
        endorsementsByDay[day] = { individual: 0, organization: 0 };
      }
      if (e.type === "organization") {
        endorsementsByDay[day].organization += 1;
      } else {
        endorsementsByDay[day].individual += 1;
      }
    }

    const endorsementTimeline: { date: string; individual: number; organization: number }[] = [];
    let cumIndividual = 0;
    let cumOrg = 0;
    for (const [date, counts] of Object.entries(endorsementsByDay)) {
      cumIndividual += counts.individual;
      cumOrg += counts.organization;
      endorsementTimeline.push({
        date,
        individual: cumIndividual,
        organization: cumOrg,
      });
    }

    // Geographic distribution of signatures
    const locationSignatures = await prisma.petitionSignature.findMany({
      where: { policyId, location: { not: null } },
      select: { location: true },
    });

    const locationCounts: Record<string, number> = {};
    for (const s of locationSignatures) {
      if (s.location) {
        locationCounts[s.location] = (locationCounts[s.location] || 0) + 1;
      }
    }

    const topLocations = Object.entries(locationCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([location, count]) => ({ location, count }));

    // Active comments (non-deleted)
    const activeComments = await prisma.comment.count({
      where: { policyId, deletedAt: null },
    });

    return NextResponse.json({
      policy: {
        id: policy.id,
        title: policy.title,
        published: policy.published,
        publishedAt: policy.publishedAt,
        createdAt: policy.createdAt,
        viewCount: policy.viewCount,
      },
      stats: {
        views: policy.viewCount,
        totalEndorsements: policy._count.endorsements,
        individualEndorsements,
        orgEndorsements,
        verifiedSignatures,
        totalSignatures,
        comments: activeComments,
      },
      signatureTimeline,
      endorsementTimeline,
      topLocations,
    });
  } catch (error) {
    console.error("GET /api/policies/[id]/admin error:", error);
    return NextResponse.json(
      { error: "Failed to load admin data." },
      { status: 500 }
    );
  }
}
