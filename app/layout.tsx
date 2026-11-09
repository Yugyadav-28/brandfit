import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Suspense } from "react";
import Link from "next/link";
import { Nav } from "@/components/nav";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "BrandFit - Brand Governance & AI Review",
  description: "Brand governance and AI-assisted content review",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.className} antialiased min-h-screen flex flex-col`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Suspense fallback={<header className="w-full h-16 border-b bg-background" />}>
            <Nav />
          </Suspense>
          <main className="flex-1 flex flex-col">{children}</main>
          <footer className="w-full border-t py-6 text-center text-xs text-muted-foreground bg-muted/20">
            <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p>BrandFit &mdash; Brand governance and AI-assisted review</p>
              <div className="flex items-center gap-4">
                <Link
                  href="/disclosure"
                  className="hover:text-foreground underline underline-offset-4 transition-colors"
                >
                  Disclosure
                </Link>
              </div>
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
