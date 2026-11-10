import { createClient } from "@/lib/supabase/server";
import { getMyMemberships } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";
import { DEMO } from "@/lib/demo";
import {
  CheckCircle2,
  FileText,
  Users,
  Sparkles,
  ShieldCheck,
  ClipboardCheck,
  BookOpen,
  ArrowRight,
} from "lucide-react";

// ─── Redirect logged-in users to their home ───────────────────────────────

async function HomeAuthCheck() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const memberships = await getMyMemberships();

    if (!memberships || memberships.length === 0) redirect("/home-start");
    if (memberships.some((m) => m.role === "employer")) redirect("/dashboard");
    if (memberships.some((m) => m.role === "reviewer")) redirect("/review");
    if (memberships.some((m) => m.role === "employee")) redirect("/my");
    redirect("/home-start");
  }

  return <LandingPage />;
}

// ─── Landing page ─────────────────────────────────────────────────────────

function LandingPage() {
  return (
    <div className="flex-1 flex flex-col items-center">
      {/* ── 1. Hero: Headline & Two Lines ── */}
      <section className="w-full max-w-3xl px-6 pt-16 pb-12 sm:pt-20 sm:pb-16 text-center">
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-foreground mb-6">
          BrandFit
        </h1>

        <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-8">
          BrandFit checks content against a company&apos;s own brand rules before
          it is published, explains every issue, and keeps humans in control.
        </p>

        {/* ── 3. Action Buttons ── */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-md mx-auto">
          <Button asChild size="lg" className="w-full sm:w-auto font-semibold">
            <Link href="/auth/login">Log in</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
            <Link href="/auth/sign-up">Sign up</Link>
          </Button>
          <Button asChild size="lg" variant="ghost" className="w-full sm:w-auto">
            <Link href="/disclosure" className="inline-flex items-center gap-1.5">
              How AI is used
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </section>

      {/* ── 2. Try the demo (3 minutes) box ── */}
      <section className="w-full max-w-3xl px-6 py-6">
        <div className="rounded-xl border bg-card p-6 sm:p-8 shadow-sm space-y-6">
          <div className="border-b pb-4">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Try the demo (3 minutes)
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Test the end-to-end workflow across roles with our pre-configured demo credentials.
            </p>
          </div>

          {/* 4 Steps */}
          <ol className="space-y-3.5 text-sm">
            {[
              {
                step: "Step 1",
                title: "Log in as the employer or employee",
                desc: "Sign in with one of the accounts below to manage guidelines or draft content.",
              },
              {
                step: "Step 2",
                title: "Submit a post",
                desc: "Write or paste marketing copy, then run the automated brand check.",
              },
              {
                step: "Step 3",
                title: "Accept or reject the suggestions and send it for review",
                desc: "Inspect flagged brand rule violations, choose what to change, and submit.",
              },
              {
                step: "Step 4",
                title: "Log in as the reviewer and approve it",
                desc: "Open the review queue as a reviewer and approve or request changes.",
              },
            ].map((s) => (
              <li key={s.step} className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-bold bg-primary/10 text-primary shrink-0 mt-0.5">
                  {s.step}
                </span>
                <div>
                  <span className="font-medium text-foreground">{s.title}</span>
                  <span className="text-muted-foreground text-xs block sm:inline sm:ml-2">
                    — {s.desc}
                  </span>
                </div>
              </li>
            ))}
          </ol>

          {/* Credentials list */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Demo Credentials
            </h3>
            <ul className="divide-y divide-border border rounded-lg bg-muted/30 text-sm overflow-hidden">
              <li className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 gap-1">
                <span className="text-muted-foreground text-xs sm:text-sm">Employer email</span>
                <span className="font-mono text-xs sm:text-sm font-semibold text-foreground select-all">
                  {DEMO.employerEmail}
                </span>
              </li>
              <li className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 gap-1">
                <span className="text-muted-foreground text-xs sm:text-sm">Reviewer email</span>
                <span className="font-mono text-xs sm:text-sm font-semibold text-foreground select-all">
                  {DEMO.reviewerEmail}
                </span>
              </li>
              <li className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 gap-1">
                <span className="text-muted-foreground text-xs sm:text-sm">Employee email</span>
                <span className="font-mono text-xs sm:text-sm font-semibold text-foreground select-all">
                  {DEMO.employeeEmail}
                </span>
              </li>
              <li className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 gap-1">
                <span className="text-muted-foreground text-xs sm:text-sm">Shared password</span>
                <span className="font-mono text-xs sm:text-sm font-semibold text-foreground select-all">
                  {DEMO.password}
                </span>
              </li>
              <li className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 gap-1">
                <span className="text-muted-foreground text-xs sm:text-sm">Company join code</span>
                <span className="font-mono text-xs sm:text-sm font-semibold text-foreground tracking-wider select-all">
                  {DEMO.joinCode}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── 4. What works today & Known limits ── */}
      <section className="w-full max-w-3xl px-6 py-12 space-y-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            What works today
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Summary of live features in this build:
          </p>
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {[
            {
              icon: <BookOpen className="h-4 w-4" />,
              title: "Brand Guidelines",
              desc: "Define custom brand rules, approved facts, and preferred terms with full CRUD.",
            },
            {
              icon: <Users className="h-4 w-4" />,
              title: "Team Management",
              desc: "6-character join codes, invite members, and switch roles between employee and reviewer.",
            },
            {
              icon: <FileText className="h-4 w-4" />,
              title: "Content Submission",
              desc: "Submit marketing copy and run automated compliance checks against brand guidelines.",
            },
            {
              icon: <Sparkles className="h-4 w-4" />,
              title: "AI Compliance Checks",
              desc: "Google Gemini flags rule violations, quotes exact text, and suggests rewrites.",
            },
            {
              icon: <CheckCircle2 className="h-4 w-4" />,
              title: "Human In The Loop",
              desc: "Creators decide which suggestions to accept or reject before sending for review.",
            },
            {
              icon: <ClipboardCheck className="h-4 w-4" />,
              title: "Review Workflow",
              desc: "Reviewers inspect submissions in a dedicated queue to approve or request changes.",
            },
            {
              icon: <ShieldCheck className="h-4 w-4" />,
              title: "Audit Logging",
              desc: "Immutable audit trail of company events, rule changes, and member actions.",
            },
          ].map((item, i) => (
            <li
              key={i}
              className="flex items-start gap-3 p-3.5 rounded-lg border bg-card/60"
            >
              <span className="shrink-0 text-primary mt-0.5">{item.icon}</span>
              <div>
                <p className="font-semibold text-foreground text-sm">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </li>
          ))}
        </ul>

        {/* One line saying this is a Round 2 build with known limits */}
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          This is a Round 2 build with known limits.
        </div>
      </section>
    </div>
  );
}

// ─── Page export ─────────────────────────────────────────────────────────

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground py-20">
          Loading…
        </div>
      }
    >
      <HomeAuthCheck />
    </Suspense>
  );
}
