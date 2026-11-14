import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  mostBrokenRules,
  repeatMistakeStats,
  rejectionRates,
  trendByPeriod,
  type InsightFinding,
  type InsightRule,
  type InsightSubmission,
  type InsightMember,
} from "@/lib/insights/compute";
import {
  InsightsDashboardClient,
  type PossiblyUnclearRuleItem,
} from "./insights-dashboard";

export const metadata = {
  title: "Insights & Analytics - BrandFit",
  description: "Brand rule violations, repeat mistakes, rule clarity, and quality trends",
};

export const maxDuration = 60;

interface PageProps {
  searchParams: Promise<{ range?: string }>;
}

async function InsightsContent({ searchParams }: PageProps) {
  const user = await requireUser();
  const admin = createAdminClient();

  // 1. Resolve membership for employer or reviewer
  const { data: memberships } = await admin
    .from("memberships")
    .select("company_id, role, display_name")
    .eq("user_id", user.id);

  if (!memberships || memberships.length === 0) {
    redirect("/home-start");
  }

  const employerM = memberships.find((m) => m.role === "employer");
  const reviewerM = memberships.find((m) => m.role === "reviewer");
  const activeMembership = employerM ?? reviewerM;

  if (!activeMembership) {
    // Only employers and reviewers can view dashboard insights
    redirect("/my");
  }

  const companyId = activeMembership.company_id;
  const isEmployer = activeMembership.role === "employer";

  // 2. Fetch company details
  const { data: company } = await admin
    .from("companies")
    .select("id, name")
    .eq("id", companyId)
    .single();

  if (!company) {
    redirect("/home-start");
  }

  // 3. Resolve date filter range (7d, 30d, all)
  const resolvedParams = await searchParams;
  let range: "7d" | "30d" | "all" = "30d";
  if (resolvedParams.range === "7d" || resolvedParams.range === "7") {
    range = "7d";
  } else if (resolvedParams.range === "all") {
    range = "all";
  } else {
    range = "30d";
  }

  const now = Date.now();
  let cutoffDate: Date | null = null;
  if (range === "7d") {
    cutoffDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
  } else if (range === "30d") {
    cutoffDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
  }

  // 4. Fetch all memberships for this company (for author names & roles)
  const { data: allMembersData } = await admin
    .from("memberships")
    .select("user_id, role, display_name")
    .eq("company_id", companyId);

  const members: InsightMember[] = (allMembersData || []).map((m) => ({
    user_id: m.user_id,
    role: m.role,
    display_name: m.display_name,
  }));

  // 5. Fetch rules for this company (include body for clearer wording suggestions)
  const { data: allRulesData } = await admin
    .from("rules")
    .select("id, code, title, body, category")
    .eq("company_id", companyId);

  const rules: InsightRule[] = (allRulesData || []).map((r) => ({
    id: r.id,
    code: r.code,
    title: r.title,
    category: r.category,
  }));

  // 6. Fetch submissions for this company (filtered by date if applicable)
  let subQuery = admin
    .from("submissions")
    .select("id, author_id, title, status, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  if (cutoffDate) {
    subQuery = subQuery.gte("created_at", cutoffDate.toISOString());
  }

  const { data: rawSubmissions } = await subQuery;
  const submissions: InsightSubmission[] = (rawSubmissions || []).map((s) => ({
    id: s.id,
    author_id: s.author_id,
    title: s.title,
    status: s.status,
    created_at: s.created_at,
  }));

  const submissionIds = submissions.map((s) => s.id);

  // 7. Fetch versions and findings for these submissions
  let allVersions: { id: string; submission_id: string; version_no: number; created_at: string }[] = [];
  let allFindingsData: {
    id: string;
    version_id: string;
    rule_code: string | null;
    decision: string | null;
    decision_note: string | null;
    quoted_text: string | null;
    created_at: string | null;
  }[] = [];

  if (submissionIds.length > 0) {
    const { data: vData } = await admin
      .from("versions")
      .select("id, submission_id, version_no, created_at")
      .in("submission_id", submissionIds)
      .order("version_no", { ascending: true });

    allVersions = (vData || []) as typeof allVersions;
    const versionIds = allVersions.map((v) => v.id);

    if (versionIds.length > 0) {
      const { data: fData } = await admin
        .from("findings")
        .select("id, version_id, rule_code, decision, decision_note, quoted_text, created_at")
        .in("version_id", versionIds);

      allFindingsData = (fData || []) as typeof allFindingsData;
    }
  }

  // 8. Identify the FIRST version of each submission
  const firstVersionIdBySubmission = new Map<string, string>();
  for (const v of allVersions) {
    if (!firstVersionIdBySubmission.has(v.submission_id)) {
      firstVersionIdBySubmission.set(v.submission_id, v.id);
    }
  }

  const firstVersionIds = new Set(firstVersionIdBySubmission.values());

  // Map version_id -> submission_id and version_no
  const versionMetaMap = new Map<string, { submission_id: string; version_no: number }>();
  for (const v of allVersions) {
    versionMetaMap.set(v.id, {
      submission_id: v.submission_id,
      version_no: v.version_no,
    });
  }

  // Convert raw findings to typed InsightFindings
  const allInsightFindings: InsightFinding[] = allFindingsData.map((f) => {
    const meta = versionMetaMap.get(f.version_id);
    const isFirst = firstVersionIds.has(f.version_id);
    return {
      id: f.id,
      version_no: meta?.version_no || 1,
      is_first_version: isFirst,
      submission_id: meta?.submission_id,
      rule_code: f.rule_code || "",
      decision: f.decision,
      created_at: f.created_at || undefined,
    };
  });

  const firstVersionFindings = allInsightFindings.filter((f) => f.is_first_version);

  // 9. Compute analytics using pure functions from compute.ts
  const brokenRules = mostBrokenRules(firstVersionFindings, rules, 8);
  const repeatStats = repeatMistakeStats(firstVersionFindings, submissions, members);
  const rejectionRatesData = rejectionRates(allInsightFindings, rules);
  const trendPeriod: "day" | "week" = range === "all" ? "week" : "day";
  const trendData = trendByPeriod(submissions, firstVersionFindings, trendPeriod);

  // 10. Extract possibly unclear rules and their writers' rejection reasons & quoted texts
  const unclearRates = rejectionRatesData.filter((r) => r.possibly_unclear);
  const unclearRulesData: PossiblyUnclearRuleItem[] = [];

  for (const rateItem of unclearRates) {
    const ruleRecord = (allRulesData || []).find(
      (r) => r.code?.trim().toUpperCase() === rateItem.code.trim().toUpperCase()
    );
    if (!ruleRecord) continue;

    // Filter rejected findings for this rule code
    const matchingRejected = allFindingsData.filter(
      (f) =>
        f.rule_code?.trim().toUpperCase() === rateItem.code.trim().toUpperCase() &&
        f.decision === "rejected"
    );

    const reasonsSet = new Set<string>();
    const quotesSet = new Set<string>();

    for (const f of matchingRejected) {
      if (f.decision_note && f.decision_note.trim().length > 0) {
        reasonsSet.add(f.decision_note.trim());
      }
      if (f.quoted_text && f.quoted_text.trim().length > 0) {
        quotesSet.add(f.quoted_text.trim());
      }
    }

    unclearRulesData.push({
      id: ruleRecord.id,
      code: ruleRecord.code,
      title: ruleRecord.title,
      body: ruleRecord.body || "",
      category: ruleRecord.category || "General",
      decided: rateItem.decided,
      rejected: rateItem.rejected,
      rejectionRate: rateItem.rejection_rate,
      rejectionReasons: Array.from(reasonsSet).slice(0, 5),
      rejectedQuotes: Array.from(quotesSet).slice(0, 5),
    });
  }

  return (
    <InsightsDashboardClient
      range={range}
      companyName={company.name}
      companyId={companyId}
      role={activeMembership.role}
      isEmployer={isEmployer}
      brokenRules={brokenRules}
      repeatStats={repeatStats}
      rejectionRatesData={rejectionRatesData}
      trendData={trendData}
      unclearRules={unclearRulesData}
      totalSubmissions={submissions.length}
      totalFindings={firstVersionFindings.length}
    />
  );
}

export default function InsightsPage({ searchParams }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="flex-1 max-w-7xl mx-auto w-full p-8 text-center text-sm text-muted-foreground">
          Loading brand insights &amp; analytics...
        </div>
      }
    >
      <InsightsContent searchParams={searchParams} />
    </Suspense>
  );
}
