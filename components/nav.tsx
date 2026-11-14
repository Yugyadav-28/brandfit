import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LogoutButton } from "@/components/logout-button";
import { NavClient, type NavLinkItem } from "@/components/nav-client";

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
      { label: "Insights", href: "/dashboard/insights" },
      { label: "Guidelines", href: "/company/guidelines" },
      { label: "Members", href: "/company/members" },
      { label: "Audit", href: "/company/audit" },
      { label: "Settings", href: "/company/settings" },
      { label: "Review", href: "/review" },
    );
  } else if (role === "reviewer") {
    links.push(
      { label: "Dashboard", href: "/dashboard" },
      { label: "Insights", href: "/dashboard/insights" },
      { label: "Review", href: "/review" },
    );
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
    <NavClient
      userEmail={user.email}
      company={company}
      role={role}
      links={links}
      logoutSlot={<LogoutButton />}
    />
  );
}
