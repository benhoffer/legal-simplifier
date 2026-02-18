import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { ToastProvider } from "@/components/Toast";
import { Nav } from "./nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  title: {
    default: "Legal Simplifier - Make Policy Accessible",
    template: "%s | Legal Simplifier",
  },
  description:
    "Simplify legal text into plain language. Browse, endorse, and sign community policy proposals.",
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: "Legal Simplifier",
    description:
      "Simplify legal text into plain language. Browse, endorse, and sign community policy proposals.",
    siteName: "Legal Simplifier",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Legal Simplifier",
    description:
      "Simplify legal text into plain language. Browse, endorse, and sign community policy proposals.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const inner = (
    <ToastProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to main content
      </a>
      <header className="relative border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
          <Link
            href="/"
            className="rounded text-lg font-bold tracking-tight text-gray-900 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Legal Simplifier
          </Link>
          <Nav />
        </div>
      </header>
      <div id="main-content">{children}</div>
    </ToastProvider>
  );

  const body = (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {inner}
      </body>
    </html>
  );

  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <ClerkProvider>{body}</ClerkProvider>;
  }

  return body;
}
