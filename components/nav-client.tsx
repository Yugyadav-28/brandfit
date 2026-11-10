"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, KeyRound, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface NavLinkItem {
  label: string;
  href: string;
}

interface NavClientProps {
  userEmail?: string | null;
  company?: {
    id: string;
    name: string;
    join_code: string;
  } | null;
  role?: string | null;
  links: NavLinkItem[];
  logoutSlot?: React.ReactNode;
}

export function NavClient({
  userEmail,
  company,
  role,
  links,
  logoutSlot,
}: NavClientProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const isLinkActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <header className="w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
        {/* Left: Brand logo & company tag */}
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm px-1 py-0.5"
          >
            BrandFit
          </Link>

          {company && (
            <span className="inline-flex items-center text-xs sm:text-sm font-semibold text-foreground px-2 py-0.5 rounded bg-muted border border-border">
              {company.name}
            </span>
          )}

          {role === "employer" && company?.join_code && (
            <div className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/30">
              <KeyRound className="h-3 w-3" aria-hidden="true" />
              <span className="text-muted-foreground font-normal">Join code:</span>
              <span className="font-mono font-bold tracking-wider">
                {company.join_code}
              </span>
            </div>
          )}
        </div>

        {/* Desktop Navigation Links */}
        <nav
          aria-label="Main Navigation"
          className="hidden md:flex items-center gap-1 sm:gap-1.5 text-sm font-medium"
        >
          {links.map((link) => {
            const active = isLinkActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs sm:text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  active
                    ? "bg-primary/10 text-primary font-semibold ring-1 ring-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                }`}
              >
                {active && (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-primary shrink-0"
                    aria-hidden="true"
                  />
                )}
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right side Desktop: Auth / User / Logout */}
        <div className="hidden md:flex items-center gap-3">
          {userEmail ? (
            <>
              <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                {userEmail}
              </span>
              {logoutSlot}
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/auth/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/auth/sign-up">Sign up</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile menu toggle button */}
        <div className="flex md:hidden items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation-menu"
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            className="p-2 rounded-md text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring border border-border"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Collapsible Menu */}
      {mobileMenuOpen && (
        <div
          id="mobile-navigation-menu"
          className="md:hidden border-t bg-card px-4 pt-3 pb-6 space-y-4 shadow-lg animate-in slide-in-from-top-2 duration-200"
        >
          {/* Join code on mobile for employer */}
          {role === "employer" && company?.join_code && (
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-300">
              <span className="flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                Join code:
              </span>
              <span className="font-mono font-bold tracking-widest text-sm">
                {company.join_code}
              </span>
            </div>
          )}

          {/* Navigation Links list */}
          <nav aria-label="Mobile Navigation" className="flex flex-col space-y-1">
            {links.map((link) => {
              const active = isLinkActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    active
                      ? "bg-primary/10 text-primary font-semibold border-l-4 border-primary pl-2.5"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <span>{link.label}</span>
                  {active && (
                    <span className="inline-flex items-center gap-1 text-xs text-primary font-bold">
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      Active
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User info & Logout */}
          <div className="pt-3 border-t border-border flex flex-col gap-3">
            {userEmail ? (
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">Signed in as</span>
                  <span className="text-sm font-medium text-foreground truncate max-w-[200px]">
                    {userEmail}
                  </span>
                </div>
                <div>{logoutSlot}</div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 pt-1">
                <Button asChild variant="outline" className="w-full justify-center">
                  <Link href="/auth/login" onClick={() => setMobileMenuOpen(false)}>
                    Sign in
                  </Link>
                </Button>
                <Button asChild className="w-full justify-center">
                  <Link href="/auth/sign-up" onClick={() => setMobileMenuOpen(false)}>
                    Sign up
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
