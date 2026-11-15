'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowRight, Info } from 'lucide-react';

interface CompanyOption {
  companyId: string;
  displayName: string;
}

interface SubmitFormProps {
  companies: CompanyOption[];
  defaultCompanyId?: string;
  ruleCounts?: Record<string, number>;
}

export function SubmitForm({
  companies,
  defaultCompanyId,
  ruleCounts,
}: SubmitFormProps) {
  const router = useRouter();

  const [companyId, setCompanyId] = useState(
    defaultCompanyId || companies[0]?.companyId || '',
  );
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const characterCount = content.length;
  const isOverLimit = characterCount > 10000;

  const hasRules = ruleCounts ? (ruleCounts[companyId] ?? 0) > 0 : true;

  function handleFillExample() {
    setTitle('FreshBrew Gold Launch Social Post');
    setContent(
      "FreshBrew Gold is the world's best coffee, guaranteed!!! Grab it now, it is super cheap.",
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (!companyId) {
      setErrorMessage('Please select a company workspace.');
      return;
    }

    if (!title.trim()) {
      setErrorMessage('Please enter a title for your submission.');
      return;
    }

    if (!content.trim()) {
      setErrorMessage('Please enter content to submit.');
      return;
    }

    if (isOverLimit) {
      setErrorMessage('Content must not exceed 10,000 characters.');
      return;
    }

    setIsSubmitting(true);
    setStatusMessage('Running quick checks');

    try {
      // 1. POST /api/submissions
      const subRes = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          title: title.trim(),
          content,
        }),
      });

      const subData = await subRes.json();
      if (!subRes.ok) {
        throw new Error(subData.error || 'Failed to create submission');
      }

      const submissionId = subData.submissionId;

      // Ensure user sees the quick checks step
      await new Promise((resolve) => setTimeout(resolve, 600));

      // 2. Asking the AI reviewer
      setStatusMessage('Asking the AI reviewer');

      let aiStatus = 'ok';
      let retrievalParam = '';
      try {
        const reviewRes = await fetch(
          `/api/submissions/${submissionId}/review`,
          {
            method: 'POST',
          },
        );
        const reviewData = await reviewRes.json();
        if (!reviewRes.ok || reviewData.aiStatus === 'unavailable') {
          aiStatus = 'unavailable';
        } else if (reviewData.aiStatus) {
          aiStatus = reviewData.aiStatus;
        }
        if (reviewData.retrieval) {
          retrievalParam = `&retrieval=${encodeURIComponent(
            JSON.stringify(reviewData.retrieval),
          )}`;
        }
      } catch (revErr) {
        console.error('Review check encountered an issue:', revErr);
        aiStatus = 'unavailable';
      }

      // 3. Saving the results
      setStatusMessage('Saving the results');
      await new Promise((resolve) => setTimeout(resolve, 600));

      // 4. Redirect to /submit/[id]
      const targetUrl = `/submit/${submissionId}?aiStatus=${aiStatus}${retrievalParam}`;

      router.push(targetUrl);
    } catch (err: any) {
      console.error('Submit error:', err);
      setErrorMessage(err.message || 'An unexpected error occurred.');
      setIsSubmitting(false);
      setStatusMessage(null);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        {errorMessage && (
          <div
            id="submit-form-error"
            role="alert"
            aria-live="polite"
            className="p-4 rounded-md bg-destructive/15 border border-destructive/30 text-destructive text-sm font-medium"
          >
            {errorMessage}
          </div>
        )}

        {/* Notice when the company has no rules yet */}
        {!hasRules && (
          <div
            role="status"
            className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-sm flex items-start gap-2.5 shadow-sm"
          >
            <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p>
              The employer has not added brand rules yet, so only basic checks
              will run. See{' '}
              <Link
                href={`/company/guidelines?companyId=${companyId}`}
                className="underline font-semibold hover:text-amber-950 dark:hover:text-amber-100"
              >
                Guidelines for employers
              </Link>
              .
            </p>
          </div>
        )}

        {/* Company Selector (if user belongs to multiple companies) */}
        {companies.length > 1 ? (
          <div>
            <label
              htmlFor="company-select"
              className="block text-sm font-medium mb-1.5 text-foreground"
            >
              Company Workspace <span className="text-destructive">*</span>
            </label>
            <select
              id="company-select"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              disabled={isSubmitting}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
            >
              {companies.map((c) => (
                <option key={c.companyId} value={c.companyId}>
                  {c.displayName}
                </option>
              ))}
            </select>
          </div>
        ) : companies.length === 1 ? (
          <div>
            <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Workspace
            </span>
            <p className="text-sm font-medium text-foreground">
              {companies[0].displayName}
            </p>
          </div>
        ) : null}

        {/* Submission Title */}
        <div>
          <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
            <label
              htmlFor="submission-title"
              className="block text-sm font-medium text-foreground"
            >
              Title <span className="text-destructive">*</span>
            </label>
            <button
              type="button"
              onClick={handleFillExample}
              disabled={isSubmitting}
              className="text-xs text-primary hover:underline font-medium min-h-[44px] inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              Try an example post
            </button>
          </div>
          <input
            id="submission-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isSubmitting}
            placeholder="e.g. FreshBrew Gold Launch Social Post"
            aria-describedby={errorMessage ? 'submit-form-error' : undefined}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            required
          />
        </div>

        {/* Large Content Textarea with Counter */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="submission-content"
              className="block text-sm font-medium text-foreground"
            >
              Content <span className="text-destructive">*</span>
            </label>
            <span
              id="content-char-counter"
              aria-live="polite"
              className={`text-xs font-mono ${
                isOverLimit
                  ? 'text-destructive font-semibold'
                  : characterCount > 9500
                  ? 'text-amber-600 font-medium'
                  : 'text-muted-foreground'
              }`}
            >
              {characterCount.toLocaleString()} / 10,000 characters
            </span>
          </div>
          <textarea
            id="submission-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={isSubmitting}
            rows={14}
            placeholder="Write or paste your brand content here to be checked against guidelines and approved facts..."
            aria-describedby={`content-char-counter ${
              isOverLimit ? 'content-limit-error' : ''
            } ${errorMessage ? 'submit-form-error' : ''}`.trim()}
            className="w-full rounded-md border border-input bg-background p-3 text-sm font-mono leading-relaxed shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            required
          />
          {isOverLimit && (
            <p
              id="content-limit-error"
              role="alert"
              className="text-xs text-destructive mt-1 font-medium"
            >
              Your content exceeds the 10,000 character maximum. Please trim it
              before submitting.
            </p>
          )}
        </div>

        {/* Step indicator while checking */}
        {isSubmitting && (
          <div
            role="status"
            aria-live="polite"
            className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-3"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              <span>{statusMessage}</span>
            </div>

            <ol className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <li
                className={`flex items-center gap-2 p-2.5 rounded border transition-colors ${
                  statusMessage === 'Running quick checks'
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : statusMessage === 'Asking the AI reviewer' ||
                      statusMessage === 'Saving the results'
                    ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200'
                    : 'border-border text-muted-foreground'
                }`}
              >
                <span className="font-bold">1.</span>
                <span>Running quick checks</span>
              </li>
              <li
                className={`flex items-center gap-2 p-2.5 rounded border transition-colors ${
                  statusMessage === 'Asking the AI reviewer'
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : statusMessage === 'Saving the results'
                    ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200'
                    : 'border-border text-muted-foreground'
                }`}
              >
                <span className="font-bold">2.</span>
                <span>Asking the AI reviewer</span>
              </li>
              <li
                className={`flex items-center gap-2 p-2.5 rounded border transition-colors ${
                  statusMessage === 'Saving the results'
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border text-muted-foreground'
                }`}
              >
                <span className="font-bold">3.</span>
                <span>Saving the results</span>
              </li>
            </ol>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex items-center justify-end pt-2">
          <Button
            type="submit"
            disabled={
              isSubmitting ||
              isOverLimit ||
              !title.trim() ||
              !content.trim()
            }
            className="min-w-44 min-h-[44px] text-sm font-semibold"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{statusMessage || 'Checking...'}</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span>Check brand rules</span>
                <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </Button>
        </div>
      </form>

      {/* Under the form list in plain words what is checked */}
      <div className="pt-4 border-t border-border text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground">What is checked:</p>
        <p className="leading-relaxed">
          Tone, terminology, claims, facts, shouting, and for images and
          documents their accessibility.
        </p>
      </div>
    </div>
  );
}
