import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return new NextResponse(verificationPage("Missing verification token."), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  try {
    const signature = await prisma.petitionSignature.findFirst({
      where: { verificationToken: token },
      include: {
        policy: { select: { id: true, title: true } },
      },
    });

    if (!signature) {
      return new NextResponse(
        verificationPage(
          "Invalid or expired verification link. Your signature may have already been verified."
        ),
        { status: 404, headers: { "Content-Type": "text/html" } }
      );
    }

    if (signature.emailVerified) {
      return new NextResponse(
        verificationPage(
          "Your signature has already been verified!",
          signature.policy.id,
          signature.policy.title
        ),
        { status: 200, headers: { "Content-Type": "text/html" } }
      );
    }

    await prisma.petitionSignature.update({
      where: { id: signature.id },
      data: { emailVerified: true, verificationToken: null },
    });

    return new NextResponse(
      verificationPage(
        "Your signature has been verified! Thank you for signing.",
        signature.policy.id,
        signature.policy.title
      ),
      { status: 200, headers: { "Content-Type": "text/html" } }
    );
  } catch (error) {
    console.error("GET /api/petitions/verify error:", error);
    return new NextResponse(
      verificationPage("An error occurred while verifying your signature."),
      { status: 500, headers: { "Content-Type": "text/html" } }
    );
  }
}

function verificationPage(
  message: string,
  policyId?: string,
  policyTitle?: string
): string {
  const link = policyId
    ? `<a href="/policies/${policyId}" style="display:inline-block;margin-top:16px;color:#2563eb;text-decoration:underline;">Back to &ldquo;${escapeHtml(policyTitle ?? "policy")}&rdquo;</a>`
    : `<a href="/policies" style="display:inline-block;margin-top:16px;color:#2563eb;text-decoration:underline;">Browse Policies</a>`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Petition Verification</title></head>
<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb;">
  <div style="text-align:center;max-width:400px;padding:32px;">
    <h1 style="font-size:1.25rem;color:#111827;">Petition Verification</h1>
    <p style="color:#4b5563;margin-top:8px;">${escapeHtml(message)}</p>
    ${link}
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
