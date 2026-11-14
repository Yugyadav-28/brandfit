import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireUser, requireMember } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { GuidelinesManager, type RuleItem, type FactItem, type TermItem } from "./guidelines-manager";

export const metadata = {
  title: "Brand Guidelines - BrandFit",
  description: "Configure brand rules, approved facts, and terminology",
};

async function GuidelinesContent() {
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

  // Strict check with requireMember
  await requireMember(companyId, "employer");

  // Fetch company details
  const { data: company } = await admin
    .from("companies")
    .select("id, name")
    .eq("id", companyId)
    .single();

  // Fetch rules
  const { data: rules } = await admin
    .from("rules")
    .select("id, code, category, title, body, needs_escalation, created_at")
    .eq("company_id", companyId)
    .order("code", { ascending: true });

  // Fetch facts
  const { data: facts } = await admin
    .from("facts")
    .select("id, code, statement, source, updated_on")
    .eq("company_id", companyId)
    .order("code", { ascending: true });

  // Fetch terms
  const { data: terms } = await admin
    .from("terms")
    .select("id, preferred, avoid, note")
    .eq("company_id", companyId)
    .order("preferred", { ascending: true });

  return (
    <GuidelinesManager
      companyId={companyId}
      companyName={company?.name || "Company"}
      initialRules={(rules || []) as RuleItem[]}
      initialFacts={(facts || []) as FactItem[]}
      initialTerms={(terms || []) as TermItem[]}
    />
  );
}

export default function GuidelinesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 max-w-7xl mx-auto w-full p-8 text-center text-sm text-muted-foreground">
          Loading brand guidelines...
        </div>
      }
    >
      <GuidelinesContent />
    </Suspense>
  );
}
