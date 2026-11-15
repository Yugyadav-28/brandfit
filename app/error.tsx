"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft, RefreshCw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global application error:", error);
  }, [error]);

  const handleGoBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/";
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6 md:p-12">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-sm text-center space-y-6">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive mx-auto">
          <AlertTriangle className="h-7 w-7" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Something went wrong
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We encountered an unexpected problem while loading this page. Please try again or return to the previous screen.
          </p>
          {error?.digest && (
            <p className="text-xs font-mono text-muted-foreground/70 pt-1">
              Error reference: {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleGoBack}
            className="w-full sm:w-auto min-h-[44px] gap-2"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Go back</span>
          </Button>
          <Button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto min-h-[44px] gap-2"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            <span>Try again</span>
          </Button>
        </div>

        <div className="pt-2 border-t border-border">
          <Button asChild variant="ghost" size="sm" className="min-h-[44px]">
            <Link href="/" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
              <Home className="h-3.5 w-3.5" aria-hidden="true" />
              Return to home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
