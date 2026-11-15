"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Circle,
  Copy,
  Check,
  X,
  Sparkles,
  ArrowRight,
} from "lucide-react";

export interface GetStartedStep {
  id: string;
  title: string;
  whyItMatters: string;
  isDone: boolean;
  href?: string;
  buttonLabel?: string;
  isInviteStep?: boolean;
}

export interface GetStartedCardProps {
  companyId: string;
  joinCode: string;
  steps: GetStartedStep[];
}

export function GetStartedCard({
  companyId,
  joinCode,
  steps,
}: GetStartedCardProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  // If every step is completed, or the employer dismissed it, do not render
  const allDone = steps.every((s) => s.isDone);
  if (isDismissed || allDone) {
    return null;
  }

  const completedCount = steps.filter((s) => s.isDone).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  const handleDismiss = () => {
    // Remember the dismissal in a cookie for 1 year
    const cookieName = `brandfit_get_started_dismissed_${companyId}`;
    document.cookie = `${cookieName}=true; path=/; max-age=31536000; SameSite=Lax`;
    setIsDismissed(true);
  };

  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(joinCode);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = joinCode;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy join code:", err);
    }
  };

  return (
    <section
      aria-label="Get started guide"
      className="bg-card border border-border rounded-xl p-6 sm:p-7 shadow-sm transition-all"
    >
      {/* ── Card Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Get started
            </h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {completedCount} of {steps.length} done
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Complete these setup steps to configure BrandFit for your team.
          </p>
        </div>

        {/* Dismiss Button */}
        <div>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss Get started guide"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md border border-border hover:bg-muted/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          >
            <span>Dismiss</span>
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* ── Progress Bar ── */}
      <div className="pt-4 pb-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
          <span>Setup progress</span>
          <span className="font-medium text-foreground">{progressPercent}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          className="w-full bg-muted rounded-full h-2 overflow-hidden"
        >
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* ── Steps List ── */}
      <ul className="divide-y divide-border mt-3" role="list">
        {steps.map((step, idx) => (
          <li
            key={step.id}
            className="py-3.5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
          >
            {/* Left: Status icon, step number, title, and sentence */}
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="pt-0.5 shrink-0">
                {step.isDone ? (
                  <CheckCircle2
                    className="h-5 w-5 text-emerald-600 dark:text-emerald-400"
                    aria-hidden="true"
                  />
                ) : (
                  <Circle
                    className="h-5 w-5 text-muted-foreground/60"
                    aria-hidden="true"
                  />
                )}
                <span className="sr-only">
                  {step.isDone ? "Completed: " : "To do: "}
                </span>
              </div>

              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-muted-foreground">
                    Step {idx + 1}
                  </span>
                  <span className="text-xs text-muted-foreground/60">•</span>
                  <h3
                    className={`text-sm font-semibold ${
                      step.isDone
                        ? "text-muted-foreground line-through decoration-muted-foreground/50"
                        : "text-foreground"
                    }`}
                  >
                    {step.title}
                  </h3>
                  {step.isDone && (
                    <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                      Done
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {step.whyItMatters}
                </p>
              </div>
            </div>

            {/* Right: Action button or invite code */}
            <div className="flex items-center gap-2 self-start sm:self-center shrink-0 pl-8 sm:pl-0">
              {step.isInviteStep ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-muted rounded-md border text-xs">
                    <span className="text-muted-foreground text-[11px]">Join code:</span>
                    <span className="font-mono font-bold tracking-wider text-foreground">
                      {joinCode}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopy}
                    aria-label={`Copy join code ${joinCode}`}
                    className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
                      copied
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-background hover:bg-muted border-input text-foreground"
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Copy code</span>
                      </>
                    )}
                  </button>
                </div>
              ) : step.href ? (
                <Button
                  asChild
                  size="sm"
                  variant={step.isDone ? "ghost" : "outline"}
                  className={`text-xs h-8 px-3 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
                    step.isDone
                      ? "text-muted-foreground hover:text-foreground"
                      : "border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground font-medium"
                  }`}
                >
                  <Link href={step.href}>
                    <span>{step.buttonLabel || "Configure"}</span>
                    <ArrowRight className="h-3 w-3 ml-1" aria-hidden="true" />
                  </Link>
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default GetStartedCard;
