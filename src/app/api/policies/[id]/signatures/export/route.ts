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
        { error: "Only the policy author can export signatures." },
        { status: 403 }
      );
    }

    const signatures = await prisma.petitionSignature.findMany({
      where: { policyId },
      orderBy: { createdAt: "desc" },
      select: {
        fullName: true,
        location: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    // Build CSV
    const header = "Full Name,Location,Email Verified,Signed At";
    const rows = signatures.map((s) => {
      const name = csvEscape(s.fullName);
      const location = csvEscape(s.location || "");
      const verified = s.emailVerified ? "Yes" : "No";
      const date = s.createdAt.toISOString();
      return `${name},${location},${verified},${date}`;
    });

    const csv = [header, ...rows].join("\n");
    const filename = `signatures-${policy.title.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("GET /api/policies/[id]/signatures/export error:", error);
    return NextResponse.json(
      { error: "Failed to export signatures." },
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
