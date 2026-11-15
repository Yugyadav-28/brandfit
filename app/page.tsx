import { createClient } from "@/lib/supabase/server";
import { getMyMemberships } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";

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
    <div className="flex-1 flex flex-col items-center justify-center">
      {/* ── Hero: Headline & Description & Action Buttons ── */}
      <section className="w-full max-w-3xl px-6 pt-16 pb-12 sm:pt-20 sm:pb-16 text-center">
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-foreground mb-6">
          BrandFit
        </h1>

        <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-8">
          BrandFit checks content against a company&apos;s own brand rules before
          it is published, explains every issue, and keeps humans in control.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-md mx-auto">
          <Button asChild size="lg" className="w-full sm:w-auto font-semibold min-h-[44px]">
            <Link href="/auth/login">Log in</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="w-full sm:w-auto min-h-[44px]">
            <Link href="/auth/sign-up">Sign up</Link>
          </Button>
          <Button asChild size="lg" variant="ghost" className="w-full sm:w-auto min-h-[44px]">
            <Link href="/disclosure" className="inline-flex items-center gap-1.5">
              How AI is used
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
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
