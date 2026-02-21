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
    default: "Agora - Policy Analysis Platform",
    template: "%s | Agora",
  },
  description:
    "A members-only policy deliberation platform. Analyze, propose, and collaborate on policy within your organization.",
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: "Agora",
    description:
      "A members-only policy deliberation platform. Analyze, propose, and collaborate on policy within your organization.",
    siteName: "Agora",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Agora",
    description:
      "A members-only policy deliberation platform. Analyze, propose, and collaborate on policy within your organization.",
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
  return (
    <ClerkProvider>
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
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
                  Agora
                </Link>
                <Nav />
              </div>
            </header>
            <div id="main-content">{children}</div>
          </ToastProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
