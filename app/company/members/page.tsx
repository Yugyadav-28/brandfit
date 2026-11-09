import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireUser, requireMember } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { MembersManager, type MemberItem } from "./members-manager";

export const metadata = {
  title: "Team Members - BrandFit",
  description: "Manage company members, roles, and join codes",
};

async function MembersContent() {
  const user = await requireUser();
  const admin = createAdminClient();

  // Find company where current user is employer
  const { data: employerMembership } = await admin
    .from("memberships")
    .select("company_id, role")
    .eq("user_id", user.id)
    .eq("role", "employer")
    .maybeSingle();

  if (!employerMembership) {
    const { data: anyMembership } = await admin
      .from("memberships")
      .select("company_id, role")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (anyMembership) {
      redirect("/dashboard");
    } else {
      redirect("/home-start");
    }
  }

  const companyId = employerMembership.company_id;

  // Strict employer verification
  await requireMember(companyId, "employer");

  // Fetch company details (owner_id, join_code, name)
  const { data: company } = await admin
    .from("companies")
    .select("id, name, join_code, owner_id")
    .eq("id", companyId)
    .single();

  if (!company) {
    redirect("/home-start");
  }

  // Fetch all members of this company
  const { data: members } = await admin
    .from("memberships")
    .select("user_id, role, display_name, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  return (
    <MembersManager
      companyId={companyId}
      companyName={company.name}
      initialJoinCode={company.join_code}
      ownerId={company.owner_id}
      currentUserId={user.id}
      members={(members || []) as MemberItem[]}
    />
  );
}

export default function MembersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 max-w-7xl mx-auto w-full p-8 text-center text-sm text-muted-foreground">
          Loading team members...
        </div>
      }
    >
      <MembersContent />
    </Suspense>
  );
}
