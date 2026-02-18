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
      include: { author: { select: { clerkId: true } } },
    });

    if (!policy) {
      return NextResponse.json(
        { error: "Policy not found." },
        { status: 404 }
      );
    }

    if (policy.author.clerkId !== clerkId) {
      return NextResponse.json(
        { error: "Only the policy author can export endorsements." },
        { status: 403 }
      );
    }

    const endorsements = await prisma.endorsement.findMany({
      where: { policyId },
      orderBy: { createdAt: "desc" },
      select: {
        type: true,
        createdAt: true,
        user: { select: { name: true, location: true } },
        organization: { select: { name: true } },
      },
    });

    const header = "Name,Type,Location,Endorsed At";
    const rows = endorsements.map((e) => {
      const name = csvEscape(
        e.type === "organization"
          ? e.organization?.name ?? "Unknown Org"
          : e.user?.name ?? "Anonymous"
      );
      const type = e.type === "organization" ? "Organization" : "Individual";
      const location = csvEscape(e.user?.location || "");
      const date = e.createdAt.toISOString();
      return `${name},${type},${location},${date}`;
    });

    const csv = [header, ...rows].join("\n");
    const filename = `endorsements-${policy.title.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("GET /api/policies/[id]/endorsements/export error:", error);
    return NextResponse.json(
      { error: "Failed to export endorsements." },
      { status: 500 }
    );
  }
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
