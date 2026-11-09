import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LogoutButton } from "@/components/logout-button";
import { Button } from "@/components/ui/button";

interface NavLinkItem {
  label: string;
  href: string;
}

export async function Nav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <header className="w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="text-lg font-bold tracking-tight text-foreground hover:opacity-90"
            >
              BrandFit
            </Link>
            <nav className="flex items-center gap-4 text-sm font-medium">
              <Link
                href="/disclosure"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Disclosure
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link href="/auth/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/auth/sign-up">Sign up</Link>
            </Button>
          </div>
        </div>
      </header>
    );
  }

  const admin = createAdminClient();
  const { data: memberships } = await admin
    .from("memberships")
    .select("company_id, role, display_name")
    .eq("user_id", user.id);

  const employerMembership = memberships?.find((m) => m.role === "employer");
  const reviewerMembership = memberships?.find((m) => m.role === "reviewer");
  const activeMembership =
    employerMembership || reviewerMembership || (memberships && memberships[0]);

  let company: { id: string; name: string; join_code: string } | null = null;
  if (activeMembership?.company_id) {
    const { data } = await admin
      .from("companies")
      .select("id, name, join_code")
      .eq("id", activeMembership.company_id)
      .maybeSingle();
    company = data;
  }

  const role = activeMembership?.role;

  // Build role-based navigation links
  // Employer: Dashboard, Guidelines, Members, Audit, Review
  // Reviewer: Review
  // Everyone: Submit, My posts, Disclosure
  const links: NavLinkItem[] = [];

  if (role === "employer") {
    links.push(
      { label: "Dashboard", href: "/dashboard" },
      { label: "Guidelines", href: "/company/guidelines" },
      { label: "Members", href: "/company/members" },
      { label: "Audit", href: "/company/audit" },
      { label: "Review", href: "/review" },
    );
  } else if (role === "reviewer") {
    links.push({ label: "Review", href: "/review" });
  }

  // Everyone links (when member of a company)
  if (activeMembership) {
    links.push(
      { label: "Submit", href: "/submit" },
      { label: "My posts", href: "/my" },
      { label: "Disclosure", href: "/disclosure" },
    );
  } else {
    // Authenticated user with no company membership yet
    links.push(
      { label: "Create company", href: "/company/new" },
      { label: "Join company", href: "/join" },
      { label: "Disclosure", href: "/disclosure" },
    );
  }

  return (
    <header className="w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:h-16 md:items-center md:justify-between px-4 sm:px-6 py-3 md:py-0 gap-3 md:gap-0">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-lg font-bold tracking-tight text-foreground hover:opacity-90"
            >
              BrandFit
            </Link>
            {company && (
              <span className="inline-flex items-center text-sm font-semibold text-foreground px-2 py-0.5 rounded bg-muted border">
                {company.name}
              </span>
            )}
          </div>

          {role === "employer" && company?.join_code && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30">
              <span className="text-muted-foreground font-normal">Join code:</span>
              <span className="font-mono font-bold tracking-wider">
                {company.join_code}
              </span>
            </div>
          )}

          <nav className="flex flex-wrap items-center gap-1 sm:gap-2 text-sm font-medium">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-2.5 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0">
          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
            {user.email}
          </span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
