import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BookOpen,
  Users,
  FileCheck2,
  FileText,
  History,
} from "lucide-react";

export const metadata = {
  title: "Dashboard - BrandFit",
  description: "Company workspace dashboard",
};

async function DashboardContent() {
  const user = await requireUser();
  const admin = createAdminClient();

  const { data: memberships } = await admin
    .from("memberships")
    .select("company_id, role, display_name")
    .eq("user_id", user.id);

  if (!memberships || memberships.length === 0) {
    redirect("/home-start");
  }

  const employerMembership = memberships.find((m) => m.role === "employer");
  const activeMembership = employerMembership || memberships[0];

  const { data: company } = await admin
    .from("companies")
    .select("id, name, join_code")
    .eq("id", activeMembership.company_id)
    .maybeSingle();

  if (!company) {
    redirect("/home-start");
  }

  const isEmployer = activeMembership.role === "employer";

  return (
    <div className="flex-1 max-w-7xl mx-auto w-full p-6 md:p-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{company.name}</h1>
          <p className="text-muted-foreground text-sm">
            Workspace Dashboard • Role:{" "}
            <span className="font-medium capitalize text-foreground">
              {activeMembership.role}
            </span>
          </p>
        </div>

        {isEmployer && (
          <div className="flex items-center gap-3 p-3 bg-muted/60 border rounded-lg">
            <div className="text-xs">
              <span className="text-muted-foreground block">Team Join Code</span>
              <span className="font-mono text-base font-bold tracking-wider">
                {company.join_code}
              </span>
            </div>
            <Link
              href={`/join?code=${company.join_code}`}
              className="text-xs underline text-primary hover:text-primary/80 ml-2"
            >
              Share link
            </Link>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isEmployer && (
          <Link href="/company/guidelines" className="group">
            <Card className="h-full hover:border-primary/50 hover:shadow-sm transition">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <div className="p-2 rounded-md bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">Guidelines</CardTitle>
                  <CardDescription>
                    Configure rules, approved facts, and preferred terms
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Set brand tone, claim limits, and terminology checks.
              </CardContent>
            </Card>
          </Link>
        )}

        {isEmployer && (
          <Link href="/company/members" className="group">
            <Card className="h-full hover:border-primary/50 hover:shadow-sm transition">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <div className="p-2 rounded-md bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">Team Members</CardTitle>
                  <CardDescription>
                    Manage employers, reviewers, and employees
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Invite collaborators using your 6-character join code.
              </CardContent>
            </Card>
          </Link>
        )}

        <Link href="/review" className="group">
          <Card className="h-full hover:border-primary/50 hover:shadow-sm transition">
            <CardHeader className="flex flex-row items-center gap-3 space-y-0">
              <div className="p-2 rounded-md bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                <FileCheck2 className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Review Queue</CardTitle>
                <CardDescription>
                  Review submitted content and AI findings
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Evaluate flagged rules, approve content, or request changes.
            </CardContent>
          </Card>
        </Link>

        <Link href="/submit" className="group">
          <Card className="h-full hover:border-primary/50 hover:shadow-sm transition">
            <CardHeader className="flex flex-row items-center gap-3 space-y-0">
              <div className="p-2 rounded-md bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Submit Content</CardTitle>
                <CardDescription>
                  Draft marketing copy and run automated checks
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Run AI checks on copy drafts before sending for review.
            </CardContent>
          </Card>
        </Link>

        {isEmployer && (
          <Link href="/company/audit" className="group">
            <Card className="h-full hover:border-primary/50 hover:shadow-sm transition">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <div className="p-2 rounded-md bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                  <History className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">Audit Trail</CardTitle>
                  <CardDescription>
                    View audit records of all workspace activities
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Trace rule updates, membership additions, and approvals.
              </CardContent>
            </Card>
          </Link>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Loading dashboard...
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
