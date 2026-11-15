"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileQuestion, ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
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
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground mx-auto">
          <FileQuestion className="h-7 w-7" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Page not found
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We couldn&apos;t find the page you are looking for. It may have been moved, renamed, or no longer exists.
          </p>
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

          <Button asChild className="w-full sm:w-auto min-h-[44px] gap-2">
            <Link href="/">
              <Home className="h-4 w-4" aria-hidden="true" />
              <span>Go to home</span>
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
