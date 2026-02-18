import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/policies`, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/organizations`, changeFrequency: "daily", priority: 0.7 },
  ];

  try {
    const policies = await prisma.policy.findMany({
      where: { published: true, deletedAt: null },
      select: { id: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 500,
    });

    const policyPages: MetadataRoute.Sitemap = policies.map((p) => ({
      url: `${siteUrl}/policies/${p.id}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

    const orgs = await prisma.organization.findMany({
      select: { id: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });

    const orgPages: MetadataRoute.Sitemap = orgs.map((o) => ({
      url: `${siteUrl}/organizations/${o.id}`,
      lastModified: o.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

    return [...staticPages, ...policyPages, ...orgPages];
  } catch {
    return staticPages;
  }
}
