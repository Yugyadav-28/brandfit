import React from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LogoutButton } from "@/components/logout-button";
import { NavClient, type NavLinkItem } from "@/components/nav-client";
import { getNavCounts } from "@/lib/insights/navCounts";

interface NavItem {
  label: React.ReactNode;
  href: string;
}

export async function Nav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const publicLinks: NavLinkItem[] = [
      { label: "Disclosure", href: "/disclosure" },
    ];
    return <NavClient links={publicLinks} />;
  }

  const admin = createAdminClient();
  const { data: memberships } = await admin
    .from("memberships")
    .select("company_id, role, display_name")
    .eq("user_id", user.id);

  const employerMembership = memberships?.find((m) => m.role === "employer");
  const reviewerMembership = memberships?.find(
    (m) => m.role === "reviewer" || m.role === "authorised_reviewer",
  );
  const activeMembership =
    employerMembership || reviewerMembership || (memberships && memberships[0]);

  let company: { id: string; name: string; join_code: string } | null = null;
  let reviewWaitingCount = 0;
  let myChangesCount = 0;

  if (activeMembership?.company_id) {
    const { data } = await admin
      .from("companies")
      .select("id, name, join_code")
      .eq("id", activeMembership.company_id)
      .maybeSingle();
    company = data;

    // Fetch navigation counts via single cheap server query filtered by company
    const counts = await getNavCounts(
      activeMembership.company_id,
      user.id,
      activeMembership.role,
    );
    reviewWaitingCount = counts.reviewWaitingCount;
    myChangesCount = counts.myChangesCount;
  }

  const role = activeMembership?.role;

  // Build badge labels
  const reviewLabel = (
    <span className="inline-flex items-center gap-1.5">
      <span>Review</span>
      {reviewWaitingCount > 0 && (
        <>
          <span
            className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[11px] font-bold leading-none rounded-full bg-primary/15 text-primary border border-primary/25"
            aria-hidden="true"
          >
            {reviewWaitingCount}
          </span>
          <span className="sr-only">
            {` (${reviewWaitingCount} ${
              reviewWaitingCount === 1 ? "post waiting" : "posts waiting"
            })`}
          </span>
        </>
      )}
    </span>
  );

  const myPostsLabel = (
    <span className="inline-flex items-center gap-1.5">
      <span>My posts</span>
      {myChangesCount > 0 && (
        <>
          <span
            className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[11px] font-bold leading-none rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
            aria-hidden="true"
          >
            {myChangesCount}
          </span>
          <span className="sr-only">
            {` (${myChangesCount} ${
              myChangesCount === 1
                ? "post with changes requested"
                : "posts with changes requested"
            })`}
          </span>
        </>
      )}
    </span>
  );

  // Build role-based navigation links
  // Employer: Dashboard, Guidelines, Members, Audit, Review
  // Reviewer: Review
  // Everyone: Submit, My posts, Disclosure
  const links: NavItem[] = [];

  if (role === "employer") {
    links.push(
      { label: "Dashboard", href: "/dashboard" },
      { label: "Insights", href: "/dashboard/insights" },
      { label: "Guidelines", href: "/company/guidelines" },
      { label: "Members", href: "/company/members" },
      { label: "Audit", href: "/company/audit" },
      { label: "Settings", href: "/company/settings" },
      { label: reviewLabel, href: "/review" },
    );
  } else if (role === "reviewer" || role === "authorised_reviewer") {
    links.push(
      { label: "Dashboard", href: "/dashboard" },
      { label: "Insights", href: "/dashboard/insights" },
      { label: reviewLabel, href: "/review" },
    );
  }

  // Everyone links (when member of a company)
  if (activeMembership) {
    links.push(
      { label: "Submit", href: "/submit" },
      { label: myPostsLabel, href: "/my" },
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
    <NavClient
      userEmail={user.email}
      company={company}
      role={role}
      links={links as unknown as NavLinkItem[]}
      logoutSlot={<LogoutButton />}
    />
  );
}
