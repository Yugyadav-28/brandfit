import { createClient } from "@/lib/supabase/server";
import { getMyMemberships } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";

async function HomeAuthCheck() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const memberships = await getMyMemberships();

    if (!memberships || memberships.length === 0) {
      redirect("/home-start");
    }

    if (memberships.some((m) => m.role === "employer")) {
      redirect("/dashboard");
    }

    if (memberships.some((m) => m.role === "reviewer")) {
      redirect("/review");
    }

    if (memberships.some((m) => m.role === "employee")) {
      redirect("/my");
    }

    redirect("/home-start");
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-3xl mx-auto">
      <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary mb-6">
        Brand Governance &amp; AI Review
      </div>
      <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl mb-6">
        Keep your brand voice consistent and compliant
      </h1>
      <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
        BrandFit helps companies set brand rules and terminology, while AI assists
        reviewers by flagging potential violations before content goes live.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center w-full max-w-xs sm:max-w-none">
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link href="/auth/login">Sign in</Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
          <Link href="/auth/sign-up">Sign up</Link>
        </Button>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Loading...
        </div>
      }
    >
      <HomeAuthCheck />
    </Suspense>
  );
}
