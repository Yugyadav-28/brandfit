import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireUser, requireMember } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { SettingsForm } from "./settings-form";

export const metadata = {
  title: "Company Settings - BrandFit",
  description: "Manage company settings and configuration",
};

async function SettingsContent() {
  const user = await requireUser();
  const admin = createAdminClient();

  // Find company where the user is an employer
  const { data: employerMembership } = await admin
    .from("memberships")
    .select("company_id, role")
    .eq("user_id", user.id)
    .eq("role", "employer")
    .maybeSingle();

  if (!employerMembership) {
    // If user has other memberships, redirect to dashboard or home-start
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

  // Strict check with requireMember for employer role
  await requireMember(companyId, "employer");

  // Fetch company details
  const { data: company } = await admin
    .from("companies")
    .select("id, name")
    .eq("id", companyId)
    .single();

  if (!company) {
    redirect("/home-start");
  }

  return <SettingsForm companyId={companyId} initialName={company.name} />;
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 max-w-2xl mx-auto w-full p-8 text-center text-sm text-muted-foreground">
          Loading company settings...
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
