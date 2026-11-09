import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { PlusCircle, KeyRound } from "lucide-react";
import { Suspense } from "react";

export const metadata = {
  title: "Get Started - BrandFit",
  description: "Create or join a company workspace",
};

async function HomeStartContent() {
  await requireUser();

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-10 max-w-2xl mx-auto w-full">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-3">
          Welcome to BrandFit
        </h1>
        <p className="text-muted-foreground text-base">
          You don&apos;t have any active company workspace yet. Choose how you&apos;d
          like to get started:
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
        <Link
          href="/company/new"
          className="group flex flex-col items-center justify-center p-8 bg-card text-card-foreground border-2 border-border rounded-xl shadow-sm hover:border-primary hover:shadow-md transition-all text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary group-hover:scale-110 transition-transform">
            <PlusCircle className="h-7 w-7" />
          </div>
          <span className="text-xl font-semibold mb-2">Create a company</span>
          <span className="text-sm text-muted-foreground">
            Set up a brand workspace as employer, invite team members, and define
            rules.
          </span>
        </Link>

        <Link
          href="/join"
          className="group flex flex-col items-center justify-center p-8 bg-card text-card-foreground border-2 border-border rounded-xl shadow-sm hover:border-primary hover:shadow-md transition-all text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary group-hover:scale-110 transition-transform">
            <KeyRound className="h-7 w-7" />
          </div>
          <span className="text-xl font-semibold mb-2">Join with a code</span>
          <span className="text-sm text-muted-foreground">
            Enter a 6-character code from your employer to join an existing brand
            workspace.
          </span>
        </Link>
      </div>
    </div>
  );
}

export default function HomeStartPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Loading...
        </div>
      }
    >
      <HomeStartContent />
    </Suspense>
  );
}
