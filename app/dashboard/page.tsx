import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import {
  ClipboardCheck,
  CheckCircle2,
  RefreshCw,
  Users,
  ArrowRight,
  BookOpen,
  AlertTriangle,
  History,
} from "lucide-react";

export const metadata = {
  title: "Dashboard - BrandFit",
  description: "Company workspace dashboard",
};

// ─── Types ──────────────────────────────────────────────────────────────────

interface WaitingSubmission {
  id: string;
  title: string;
  author_display_name: string;
  created_at: string;
  findings_count: number;
}

interface EmployeeStats {
  user_id: string;
  display_name: string;
  submissions: number;
  total_findings: number;
  accepted: number;
  rejected: number;
  repeated_mistakes: number;
}

// ─── Data fetching helpers ───────────────────────────────────────────────────

async function fetchDashboardData(companyId: string) {
  const admin = createAdminClient();

  // 1. All submissions for this company
  const { data: allSubmissions } = await admin
    .from("submissions")
    .select("id, title, status, author_id, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  const submissions = allSubmissions ?? [];

  // Status counts
  const inReviewCount = submissions.filter((s) => s.status === "in_review").length;
  const approvedCount = submissions.filter((s) => s.status === "approved").length;
  const changesCount = submissions.filter(
    (s) => s.status === "changes_requested",
  ).length;

  // 2. Members count
  const { count: membersCount } = await admin
    .from("memberships")
    .select("user_id", { count: "exact", head: true })
    .eq("company_id", companyId);

  // 3. All memberships (for display_name lookup + employee stats)
  const { data: allMembers } = await admin
    .from("memberships")
    .select("user_id, role, display_name")
    .eq("company_id", companyId);

  const memberMap = new Map(
    (allMembers ?? []).map((m) => [m.user_id, m]),
  );

  // 4. All versions for submissions in this company
  const submissionIds = submissions.map((s) => s.id);

  let versionsBySubmission = new Map<string, string[]>(); // submissionId → versionIds
  let findingsByVersion = new Map<string, { rule_code: string; decision: string }[]>();

  if (submissionIds.length > 0) {
    const { data: allVersions } = await admin
      .from("versions")
      .select("id, submission_id")
      .in("submission_id", submissionIds);

    const versions = allVersions ?? [];
    for (const v of versions) {
      const existing = versionsBySubmission.get(v.submission_id) ?? [];
      existing.push(v.id);
      versionsBySubmission.set(v.submission_id, existing);
    }

    const allVersionIds = versions.map((v) => v.id);

    if (allVersionIds.length > 0) {
      const { data: allFindings } = await admin
        .from("findings")
        .select("id, version_id, rule_code, decision")
        .in("version_id", allVersionIds);

      for (const f of allFindings ?? []) {
        const existing = findingsByVersion.get(f.version_id) ?? [];
        existing.push({ rule_code: f.rule_code ?? "", decision: f.decision ?? "pending" });
        findingsByVersion.set(f.version_id, existing);
      }
    }
  }

  // Helper: get all findings for a submission (across all its versions)
  function findingsForSubmission(submissionId: string) {
    const vIds = versionsBySubmission.get(submissionId) ?? [];
    return vIds.flatMap((vId) => findingsByVersion.get(vId) ?? []);
  }

  // 5. Build "Waiting for review" table
  const waitingSubmissions: WaitingSubmission[] = submissions
    .filter((s) => s.status === "in_review")
    .map((s) => ({
      id: s.id,
      title: s.title,
      author_display_name:
        memberMap.get(s.author_id)?.display_name ?? "Unknown",
      created_at: s.created_at,
      findings_count: findingsForSubmission(s.id).length,
    }));

  // 6. Build Team Activity — one row per employee
  const employees = (allMembers ?? []).filter((m) => m.role === "employee");

  const employeeStats: EmployeeStats[] = employees.map((emp) => {
    const empSubmissions = submissions.filter((s) => s.author_id === emp.user_id);

    // Collect all findings across all submissions
    const allF = empSubmissions.flatMap((s) => findingsForSubmission(s.id));

    const accepted = allF.filter((f) => f.decision === "accepted").length;
    const rejected = allF.filter((f) => f.decision === "rejected").length;

    // Repeated mistakes: rule_codes that appear in findings of 2+ different submissions
    const ruleCodeToSubmissionIds = new Map<string, Set<string>>();
    for (const sub of empSubmissions) {
      const subFindings = findingsForSubmission(sub.id);
      for (const f of subFindings) {
        const code = f.rule_code;
        if (!code || code === "TERM") continue;
        const set = ruleCodeToSubmissionIds.get(code) ?? new Set<string>();
        set.add(sub.id);
        ruleCodeToSubmissionIds.set(code, set);
      }
    }
    const repeatedMistakes = [...ruleCodeToSubmissionIds.values()].filter(
      (s) => s.size >= 2,
    ).length;

    return {
      user_id: emp.user_id,
      display_name: emp.display_name ?? "Unknown",
      submissions: empSubmissions.length,
      total_findings: allF.length,
      accepted,
      rejected,
      repeated_mistakes: repeatedMistakes,
    };
  });

  // Sort by submissions descending
  employeeStats.sort((a, b) => b.submissions - a.submissions);

  return {
    inReviewCount,
    approvedCount,
    changesCount,
    membersCount: membersCount ?? 0,
    waitingSubmissions,
    employeeStats,
  };
}

// ─── Dashboard Content ───────────────────────────────────────────────────────

async function DashboardContent() {
  const user = await requireUser();
  const admin = createAdminClient();

  // Resolve the user's membership — employer or reviewer
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
    // Employee-only: redirect to /my
    redirect("/my");
  }

  const companyId = activeMembership.company_id;

  // Strict role check
  const allowedRoles: ("employer" | "reviewer")[] = ["employer", "reviewer"];
  if (!allowedRoles.includes(activeMembership.role as "employer" | "reviewer")) {
    redirect("/my");
  }

  const { data: company } = await admin
    .from("companies")
    .select("id, name, join_code")
    .eq("id", companyId)
    .single();

  if (!company) redirect("/home-start");

  const isEmployer = activeMembership.role === "employer";

  const {
    inReviewCount,
    approvedCount,
    changesCount,
    membersCount,
    waitingSubmissions,
    employeeStats,
  } = await fetchDashboardData(companyId);

  return (
    <div className="flex-1 max-w-7xl mx-auto w-full p-6 md:p-8 space-y-10">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold tracking-tight">{company.name}</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-primary/10 text-primary border border-primary/20 capitalize">
              {activeMembership.role}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">Workspace Dashboard</p>
        </div>

        {isEmployer && (
          <div className="flex items-center gap-3 p-3 bg-muted/60 border rounded-lg text-sm">
            <span className="text-muted-foreground">Join code:</span>
            <span className="font-mono font-bold tracking-wider text-base">
              {company.join_code}
            </span>
            <Link
              href={`/join?code=${company.join_code}`}
              className="text-xs underline text-primary hover:text-primary/80 ml-1"
            >
              Share
            </Link>
          </div>
        )}
      </div>

      {/* ── Stat Cards ── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          Overview
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<ClipboardCheck className="h-5 w-5" />}
            label="Waiting for review"
            value={inReviewCount}
            accent="blue"
            href="/review"
          />
          <StatCard
            icon={<CheckCircle2 className="h-5 w-5" />}
            label="Approved"
            value={approvedCount}
            accent="green"
          />
          <StatCard
            icon={<RefreshCw className="h-5 w-5" />}
            label="Changes requested"
            value={changesCount}
            accent="amber"
          />
          <StatCard
            icon={<Users className="h-5 w-5" />}
            label="Total members"
            value={membersCount}
            accent="purple"
            href={isEmployer ? "/company/members" : undefined}
          />
        </div>
      </section>

      {/* ── Waiting for Review table ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Waiting for review</h2>
          <Link
            href="/review"
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            Open review queue <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {waitingSubmissions.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck className="h-8 w-8" />}
            heading="No submissions waiting"
            body="Once a team member sends content for review it will appear here. Invite employees from the Members page so they can start submitting."
          />
        ) : (
          <div className="border rounded-lg bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/60 text-muted-foreground border-b text-xs uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-semibold">Title</th>
                    <th scope="col" className="px-5 py-3 font-semibold w-44">Author</th>
                    <th scope="col" className="px-5 py-3 font-semibold w-36">Submitted</th>
                    <th scope="col" className="px-5 py-3 font-semibold w-28 text-center">Findings</th>
                    <th scope="col" className="px-5 py-3 font-semibold text-right w-28">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {waitingSubmissions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-4 font-medium text-foreground">
                        {sub.title}
                      </td>
                      <td className="px-5 py-4 text-muted-foreground text-xs">
                        {sub.author_display_name}
                      </td>
                      <td className="px-5 py-4 text-muted-foreground text-xs">
                        {new Date(sub.created_at).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="px-5 py-4 text-center">
                        {sub.findings_count > 0 ? (
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs font-bold border border-amber-500/30">
                            {sub.findings_count}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/review/${sub.id}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          Review <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ── Team Activity table ── */}
      {isEmployer && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Team activity</h2>
            <Link
              href="/company/members"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              Manage members <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {employeeStats.length === 0 ? (
            <EmptyState
              icon={<Users className="h-8 w-8" />}
              heading="No employees yet"
              body="Share the company join code from the Members page so employees can join and start submitting content."
            />
          ) : (
            <div className="border rounded-lg bg-card overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/60 text-muted-foreground border-b text-xs uppercase tracking-wider">
                    <tr>
                      <th scope="col" className="px-5 py-3 font-semibold">Employee</th>
                      <th scope="col" className="px-5 py-3 font-semibold text-center w-32">Submissions</th>
                      <th scope="col" className="px-5 py-3 font-semibold text-center w-32">Total findings</th>
                      <th scope="col" className="px-5 py-3 font-semibold text-center w-28">Accepted</th>
                      <th scope="col" className="px-5 py-3 font-semibold text-center w-28">Rejected</th>
                      <th scope="col" className="px-5 py-3 font-semibold text-center w-40">
                        <span title="Number of rule codes that appear in findings of two or more of this person's submissions">
                          Repeated mistakes
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {employeeStats.map((emp) => (
                      <tr key={emp.user_id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-4 font-medium text-foreground">
                          {emp.display_name}
                        </td>
                        <td className="px-5 py-4 text-center text-muted-foreground">
                          {emp.submissions}
                        </td>
                        <td className="px-5 py-4 text-center text-muted-foreground">
                          {emp.total_findings}
                        </td>
                        <td className="px-5 py-4 text-center">
                          {emp.accepted > 0 ? (
                            <span className="text-green-700 dark:text-green-400 font-medium">
                              {emp.accepted}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-center">
                          {emp.rejected > 0 ? (
                            <span className="text-destructive font-medium">
                              {emp.rejected}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-center">
                          {emp.repeated_mistakes > 0 ? (
                            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-semibold">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              {emp.repeated_mistakes}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── Quick Links (employer only) ── */}
      {isEmployer && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
            Quick links
          </h2>
          <div className="flex flex-wrap gap-3">
            <QuickLink href="/company/guidelines" icon={<BookOpen className="h-4 w-4" />} label="Guidelines" />
            <QuickLink href="/company/members" icon={<Users className="h-4 w-4" />} label="Members" />
            <QuickLink href="/company/audit" icon={<History className="h-4 w-4" />} label="Audit trail" />
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Small helpers ───────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  accent,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent: "blue" | "green" | "amber" | "purple";
  href?: string;
}) {
  const colorMap = {
    blue: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    green: "bg-green-500/10 text-green-700 dark:text-green-400",
    amber: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    purple: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  };

  const inner = (
    <div className="bg-card border rounded-xl p-5 shadow-sm flex items-center gap-4 hover:border-primary/40 hover:shadow transition-all">
      <div className={`p-2.5 rounded-lg ${colorMap[accent]}`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-foreground leading-none mb-1">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );

  return href ? <Link href={href}>{inner}</Link> : <div>{inner}</div>;
}

function EmptyState({
  icon,
  heading,
  body,
}: {
  icon: React.ReactNode;
  heading: string;
  body: string;
}) {
  return (
    <div className="border rounded-lg bg-card p-10 text-center space-y-3">
      <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground mx-auto">
        {icon}
      </div>
      <p className="font-semibold text-foreground">{heading}</p>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto">{body}</p>
    </div>
  );
}

function QuickLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border bg-card text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-muted/40 transition-colors"
    >
      {icon}
      {label}
    </Link>
  );
}

// ─── Page export ─────────────────────────────────────────────────────────────

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Loading dashboard…
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
