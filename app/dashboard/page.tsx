import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import {
  ClipboardCheck,
  CheckCircle2,
  RefreshCw,
  Users,
  ArrowRight,
  BookOpen,
  AlertTriangle,
  History,
  AlertCircle,
  Edit3,
  BarChart3,
  ShieldAlert,
} from "lucide-react";
import { calculateTeamActivity, type TeamActivityRow } from "@/lib/insights/teamActivity";

export const metadata = {
  title: "Dashboard - BrandFit",
  description: "Company workspace dashboard",
};

// ─── Types ──────────────────────────────────────────────────────────────────

interface WaitingSubmission {
  id: string;
  title: string;
  status: string;
  author_display_name: string;
  created_at: string;
  findings_count: number;
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
  const escalatedCount = submissions.filter((s) => s.status === "escalated").length;
  const approvedCount = submissions.filter((s) => s.status === "approved").length;
  const changesCount = submissions.filter(
    (s) => s.status === "changes_requested",
  ).length;

  // 2. Members count
  const { count: membersCount } = await admin
    .from("memberships")
    .select("user_id", { count: "exact", head: true })
    .eq("company_id", companyId);

  // 3. All memberships (for display_name lookup + team stats)
  const { data: allMembers } = await admin
    .from("memberships")
    .select("user_id, role, display_name")
    .eq("company_id", companyId);

  const memberMap = new Map(
    (allMembers ?? []).map((m) => [m.user_id, m]),
  );

  // 4. All versions and findings for submissions in this company
  const submissionIds = submissions.map((s) => s.id);

  let allVersions: { id: string; submission_id: string; version_no?: number; created_at?: string }[] = [];
  let allFindings: { id: string; version_id: string; rule_code?: string | null; decision?: string | null }[] = [];

  if (submissionIds.length > 0) {
    const { data: versionsData } = await admin
      .from("versions")
      .select("id, submission_id, version_no, created_at")
      .in("submission_id", submissionIds);

    allVersions = versionsData ?? [];
    const allVersionIds = allVersions.map((v) => v.id);

    if (allVersionIds.length > 0) {
      const { data: findingsData } = await admin
        .from("findings")
        .select("id, version_id, rule_code, decision")
        .in("version_id", allVersionIds);

      allFindings = findingsData ?? [];
    }
  }

  // Map versions to submissions and findings count
  const versionIdsBySubmission = new Map<string, string[]>();
  for (const v of allVersions) {
    const list = versionIdsBySubmission.get(v.submission_id) ?? [];
    list.push(v.id);
    versionIdsBySubmission.set(v.submission_id, list);
  }

  const findingsCountByVersion = new Map<string, number>();
  for (const f of allFindings) {
    findingsCountByVersion.set(f.version_id, (findingsCountByVersion.get(f.version_id) ?? 0) + 1);
  }

  // 5. Build "Waiting for review" table (includes in_review and escalated posts)
  const waitingSubmissions: WaitingSubmission[] = submissions
    .filter((s) => s.status === "in_review" || s.status === "escalated")
    .map((s) => {
      const vIds = versionIdsBySubmission.get(s.id) ?? [];
      const findingsCount = vIds.reduce((sum, vid) => sum + (findingsCountByVersion.get(vid) ?? 0), 0);
      return {
        id: s.id,
        title: s.title,
        status: s.status,
        author_display_name:
          memberMap.get(s.author_id)?.display_name ?? "Unknown",
        created_at: s.created_at,
        findings_count: findingsCount,
      };
    });

  // 6. Build Team Activity according to Round 3 definitions
  const employeeStats: TeamActivityRow[] = calculateTeamActivity(
    allMembers ?? [],
    submissions,
    allVersions,
    allFindings,
  );

  return {
    inReviewCount,
    escalatedCount,
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
  const reviewerM = memberships.find((m) => m.role === "reviewer" || m.role === "authorised_reviewer");
  const activeMembership = employerM ?? reviewerM;

  if (!activeMembership) {
    // Employee-only: redirect to /my
    redirect("/my");
  }

  const companyId = activeMembership.company_id;

  // Strict role check
  const allowedRoles = ["employer", "reviewer", "authorised_reviewer"];
  if (!allowedRoles.includes(activeMembership.role)) {
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
    escalatedCount,
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
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-primary/10 text-primary border border-primary/20 capitalize">
              {company.name} ({activeMembership.role})
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Review submissions waiting for approval, track team activity, and manage company brand settings.
          </p>
        </div>

        {isEmployer && (
          <div className="flex items-center gap-3 p-3 bg-muted/60 border rounded-lg text-sm">
            <span className="text-muted-foreground">Join code:</span>
            <span className="font-mono font-bold tracking-wider text-base">
              {company.join_code}
            </span>
            <Link
              href={`/join?code=${company.join_code}`}
              className="text-xs underline text-primary hover:text-primary/80 ml-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard
            icon={<ClipboardCheck className="h-5 w-5" />}
            label="Waiting for review"
            value={inReviewCount}
            accent="blue"
            href="/review"
          />
          <StatCard
            icon={<ShieldAlert className="h-5 w-5" />}
            label="Escalated"
            value={escalatedCount}
            accent="purple"
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
            heading="No submissions waiting for review"
            body="When team members submit content, it will appear here for review. You can create a test submission or invite teammates to start submitting."
            action={
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Button asChild size="sm">
                  <Link href="/submit">Submit a post</Link>
                </Button>
                {isEmployer && (
                  <Button asChild variant="outline" size="sm">
                    <Link href="/company/members">Invite team members</Link>
                  </Button>
                )}
              </div>
            }
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
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>{sub.title}</span>
                          {sub.status === "escalated" && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-300 dark:border-purple-800 uppercase tracking-wide">
                              <ShieldAlert className="h-3 w-3" />
                              Escalated
                            </span>
                          )}
                        </div>
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
              heading="No team activity yet"
              body="Share the company join code with your teammates so they can join and start submitting content."
              action={
                <Button asChild size="sm">
                  <Link href="/company/members">Manage members &amp; get join code</Link>
                </Button>
              }
            />
          ) : (
            <div className="border rounded-lg bg-card overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/60 text-muted-foreground border-b text-xs uppercase tracking-wider">
                    <tr>
                      <th scope="col" className="px-5 py-3 font-semibold">Member</th>
                      <th scope="col" className="px-5 py-3 font-semibold text-center w-28">Role</th>
                      <th scope="col" className="px-5 py-3 font-semibold text-center w-28">Submissions</th>
                      <th scope="col" className="px-5 py-3 font-semibold text-center w-32">
                        <span title="Findings in the first version of each submission">Total findings</span>
                      </th>
                      <th scope="col" className="px-5 py-3 font-semibold text-center w-24">Accepted</th>
                      <th scope="col" className="px-5 py-3 font-semibold text-center w-24">Edited</th>
                      <th scope="col" className="px-5 py-3 font-semibold text-center w-24">Rejected</th>
                      <th scope="col" className="px-5 py-3 font-semibold text-center w-40">
                        <span title="Number of rule codes that appear in the first version of two or more of this person's submissions">
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
                        <td className="px-5 py-4 text-center">
                          <span className="text-xs px-2 py-0.5 rounded-full capitalize bg-muted font-medium text-muted-foreground">
                            {emp.role.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center text-muted-foreground">
                          {emp.submissions}
                        </td>
                        <td className="px-5 py-4 text-center text-muted-foreground">
                          {emp.total_findings}
                        </td>
                        <td className="px-5 py-4 text-center">
                          {emp.accepted > 0 ? (
                            <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400 font-medium">
                              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                              {emp.accepted}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-center">
                          {emp.edited > 0 ? (
                            <span className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-400 font-medium">
                              <Edit3 className="h-3 w-3" aria-hidden="true" />
                              {emp.edited}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-center">
                          {emp.rejected > 0 ? (
                            <span className="inline-flex items-center gap-1 text-destructive font-medium">
                              <AlertCircle className="h-3 w-3" aria-hidden="true" />
                              {emp.rejected}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-center">
                          {emp.repeated_mistakes > 0 ? (
                            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-semibold">
                              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
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

      {/* ── Quick Links ── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          Quick links
        </h2>
        <div className="flex flex-wrap gap-3">
          <QuickLink href="/dashboard/insights" icon={<BarChart3 className="h-4 w-4" />} label="Insights" />
          {isEmployer && (
            <>
              <QuickLink href="/company/guidelines" icon={<BookOpen className="h-4 w-4" />} label="Guidelines" />
              <QuickLink href="/company/members" icon={<Users className="h-4 w-4" />} label="Members" />
              <QuickLink href="/company/audit" icon={<History className="h-4 w-4" />} label="Audit trail" />
            </>
          )}
        </div>
      </section>
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
  action,
}: {
  icon: React.ReactNode;
  heading: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border rounded-lg bg-card p-10 text-center space-y-4">
      <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground mx-auto">
        {icon}
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-foreground text-base">{heading}</p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">{body}</p>
      </div>
      {action && <div className="pt-2">{action}</div>}
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
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border bg-card text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
