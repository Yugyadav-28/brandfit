'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowRight } from 'lucide-react';

interface CompanyOption {
  companyId: string;
  displayName: string;
}

interface SubmitFormProps {
  companies: CompanyOption[];
  defaultCompanyId?: string;
}

export function SubmitForm({ companies, defaultCompanyId }: SubmitFormProps) {
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
    setStatusMessage('Creating submission draft...');

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

      // 2. POST /api/submissions/[id]/review while showing "Checking your content"
      setStatusMessage('Checking your content...');

      let aiStatus = 'ok';
      let retrievalParam = '';
      try {
        const reviewRes = await fetch(`/api/submissions/${submissionId}/review`, {
          method: 'POST',
        });
        const reviewData = await reviewRes.json();
        if (!reviewRes.ok || reviewData.aiStatus === 'unavailable') {
          aiStatus = 'unavailable';
        } else if (reviewData.aiStatus) {
          aiStatus = reviewData.aiStatus;
        }
        if (reviewData.retrieval) {
          retrievalParam = `&retrieval=${encodeURIComponent(JSON.stringify(reviewData.retrieval))}`;
        }
      } catch (revErr) {
        console.error('Review check encountered an issue:', revErr);
        aiStatus = 'unavailable';
      }

      // 3. Redirect to /submit/[id]
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {errorMessage && (
        <div
          role="alert"
          className="p-4 rounded-md bg-destructive/15 border border-destructive/30 text-destructive text-sm"
        >
          {errorMessage}
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
        <label
          htmlFor="submission-title"
          className="block text-sm font-medium mb-1.5 text-foreground"
        >
          Title <span className="text-destructive">*</span>
        </label>
        <input
          id="submission-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isSubmitting}
          placeholder="e.g. FreshBrew Gold Launch Social Post"
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
          className="w-full rounded-md border border-input bg-background p-3 text-sm font-mono leading-relaxed shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          required
        />
        {isOverLimit && (
          <p className="text-xs text-destructive mt-1 font-medium">
            Your content exceeds the 10,000 character maximum. Please trim it
            before submitting.
          </p>
        )}
      </div>

      {/* Submit Button & Progress Indicator */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-muted-foreground">
          Content is checked for terminology, claims, shouting, and approved facts.
        </p>

        <Button
          type="submit"
          disabled={isSubmitting || isOverLimit || !title.trim() || !content.trim()}
          className="min-w-44"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{statusMessage || 'Checking your content...'}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <span>Submit & Review</span>
              <ArrowRight className="h-4 w-4" />
            </span>
          )}
        </Button>
      </div>
    </form>
  );
}
