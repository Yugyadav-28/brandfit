'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { AiBadge } from '@/components/ai-badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Edit3,
  RefreshCw,
  ArrowLeft,
  FileCheck2,
  BookOpen,
  Info,
  Save,
} from 'lucide-react';

export interface FindingItem {
  id: string;
  version_id: string;
  source: 'rule_check' | 'ai';
  category: string;
  severity: 'high' | 'medium' | 'low';
  quoted_text: string;
  explanation: string;
  rule_code: string;
  suggestion: string;
  confidence: number;
  decision: 'pending' | 'accepted' | 'edited' | 'rejected';
  decision_note?: string | null;
  edited_text?: string | null;
  created_at?: string;
}

export interface RuleItem {
  code: string;
  category?: string;
  title?: string;
  body?: string;
}

export interface FactItem {
  code: string;
  statement: string;
  source?: string;
}

export interface TermItem {
  avoid: string;
  preferred: string;
  note?: string;
}

export interface SubmissionData {
  id: string;
  title: string;
  status: string;
  company_id: string;
  author_id: string;
}

export interface VersionData {
  id: string;
  version_no: number;
  content: string;
}

interface SubmissionReviewClientProps {
  submission: SubmissionData;
  latestVersion: VersionData;
  initialFindings: FindingItem[];
  rules: RuleItem[];
  facts: FactItem[];
  terms: TermItem[];
  initialAiStatus: 'ok' | 'unavailable';
}

const SEVERITY_RANK: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function getCitationInfo(
  ruleCode: string,
  quotedText: string,
  rules: RuleItem[],
  facts: FactItem[],
  terms: TermItem[],
) {
  if (ruleCode === 'TERM') {
    const term = terms.find(
      (t) =>
        t.avoid.toLowerCase().includes(quotedText.toLowerCase()) ||
        quotedText.toLowerCase().includes(t.avoid.toLowerCase()),
    );
    if (term) {
      return {
        code: 'TERM',
        title: 'Brand Terminology Standard',
        body: `Avoid: "${term.avoid}" → Preferred: "${term.preferred}"${
          term.note ? ` (${term.note})` : ''
        }`,
      };
    }
    return {
      code: 'TERM',
      title: 'Brand Terminology Standard',
      body: 'Always adhere to approved brand terminology and avoid restricted phrasing.',
    };
  }

  const rule = rules.find(
    (r) => r.code.toUpperCase() === ruleCode.toUpperCase(),
  );
  if (rule) {
    return {
      code: rule.code,
      title: rule.title || 'Brand Guideline Rule',
      body: rule.body || 'No description provided.',
    };
  }

  const fact = facts.find(
    (f) => f.code.toUpperCase() === ruleCode.toUpperCase(),
  );
  if (fact) {
    return {
      code: fact.code,
      title: 'Approved Company Fact',
      body: `${fact.statement}${fact.source ? ` (Source: ${fact.source})` : ''}`,
    };
  }

  return {
    code: ruleCode,
    title: 'Brand Rule Citation',
    body: `Referenced brand guideline code ${ruleCode}.`,
  };
}

export function SubmissionReviewClient({
  submission,
  latestVersion,
  initialFindings,
  rules,
  facts,
  terms,
  initialAiStatus,
}: SubmissionReviewClientProps) {
  const [workingText, setWorkingText] = useState(latestVersion.content);
  const [currentVersionNo, setCurrentVersionNo] = useState(
    latestVersion.version_no,
  );
  const [findings, setFindings] = useState<FindingItem[]>(() => {
    return [...initialFindings].sort(
      (a, b) =>
        (SEVERITY_RANK[a.severity] ?? 99) - (SEVERITY_RANK[b.severity] ?? 99),
    );
  });
  const [aiStatus, setAiStatus] = useState<'ok' | 'unavailable'>(
    initialAiStatus,
  );
  const [isRetryingReview, setIsRetryingReview] = useState(false);

  // Card interactive state
  const [activeEditId, setActiveEditId] = useState<string | null>(null);
  const [customEditText, setCustomEditText] = useState('');
  const [activeRejectId, setActiveRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  // New version saving state
  const [isSavingVersion, setIsSavingVersion] = useState(false);
  const [saveVersionMessage, setSaveVersionMessage] = useState<string | null>(
    null,
  );

  // Assign numbers to findings based on their severity order (high first)
  const numberedFindings = useMemo(() => {
    return findings.map((f, idx) => ({
      ...f,
      findingNumber: idx + 1,
    }));
  }, [findings]);

  // Compute non-overlapping highlight spans on workingText for first occurrences only
  const highlightSpans = useMemo(() => {
    interface Span {
      start: number;
      end: number;
      findingNumber: number;
      findingId: string;
      quoted: string;
      decision: string;
    }

    const candidateSpans: Span[] = [];

    // Find first match for each finding
    for (const f of numberedFindings) {
      if (!f.quoted_text) continue;
      const startIdx = workingText.indexOf(f.quoted_text);
      if (startIdx !== -1) {
        candidateSpans.push({
          start: startIdx,
          end: startIdx + f.quoted_text.length,
          findingNumber: f.findingNumber,
          findingId: f.id,
          quoted: f.quoted_text,
          decision: f.decision,
        });
      }
    }

    // Sort by start position
    candidateSpans.sort((a, b) => a.start - b.start || b.end - a.end);

    // Pick non-overlapping spans
    const resolved: Span[] = [];
    let lastEnd = 0;

    for (const span of candidateSpans) {
      if (span.start >= lastEnd) {
        resolved.push(span);
        lastEnd = span.end;
      }
    }

    return resolved;
  }, [workingText, numberedFindings]);

  // Render text with <mark> tags and number badges
  const renderedContent = useMemo(() => {
    if (highlightSpans.length === 0) {
      return workingText;
    }

    const fragments: React.ReactNode[] = [];
    let currentPos = 0;

    highlightSpans.forEach((span, idx) => {
      if (span.start > currentPos) {
        fragments.push(workingText.slice(currentPos, span.start));
      }

      const matchText = workingText.slice(span.start, span.end);

      fragments.push(
        <mark
          key={`${span.findingId}-${idx}`}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-sm bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-700 text-foreground"
        >
          <span
            aria-label={`Issue number ${span.findingNumber}`}
            className="inline-flex items-center justify-center text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-600 text-white select-none shrink-0"
          >
            #{span.findingNumber}
          </span>
          <span className="font-sans font-medium">{matchText}</span>
        </mark>,
      );

      currentPos = span.end;
    });

    if (currentPos < workingText.length) {
      fragments.push(workingText.slice(currentPos));
    }

    return fragments;
  }, [workingText, highlightSpans]);

  // Handle Accept
  async function handleAccept(finding: FindingItem) {
    setActionError(null);
    try {
      const res = await fetch(`/api/findings/${finding.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'accepted' }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to accept finding');
      }

      // Apply suggestion to working copy (replaces first match)
      setWorkingText((prev) => prev.replace(finding.quoted_text, finding.suggestion));

      // Update finding locally without full reload
      setFindings((prev) =>
        prev.map((f) =>
          f.id === finding.id ? { ...f, decision: 'accepted' } : f,
        ),
      );
    } catch (err: any) {
      setActionError(err.message || 'Error accepting suggestion');
    }
  }

  // Handle Edit Submit
  async function handleApplyEdit(finding: FindingItem) {
    setActionError(null);
    if (!customEditText.trim()) {
      setActionError('Replacement text cannot be empty');
      return;
    }

    try {
      const res = await fetch(`/api/findings/${finding.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: 'edited',
          editedText: customEditText.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to apply custom replacement');
      }

      // Apply replacement to working copy
      setWorkingText((prev) =>
        prev.replace(finding.quoted_text, customEditText.trim()),
      );

      // Update finding locally
      setFindings((prev) =>
        prev.map((f) =>
          f.id === finding.id
            ? { ...f, decision: 'edited', edited_text: customEditText.trim() }
            : f,
        ),
      );

      setActiveEditId(null);
      setCustomEditText('');
    } catch (err: any) {
      setActionError(err.message || 'Error updating finding');
    }
  }

  // Handle Reject Submit
  async function handleApplyReject(finding: FindingItem) {
    setActionError(null);
    if (!rejectNote.trim()) {
      setActionError('A short reason is required when rejecting a finding');
      return;
    }

    try {
      const res = await fetch(`/api/findings/${finding.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: 'rejected',
          note: rejectNote.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to reject finding');
      }

      // Update finding locally
      setFindings((prev) =>
        prev.map((f) =>
          f.id === finding.id
            ? { ...f, decision: 'rejected', decision_note: rejectNote.trim() }
            : f,
        ),
      );

      setActiveRejectId(null);
      setRejectNote('');
    } catch (err: any) {
      setActionError(err.message || 'Error rejecting finding');
    }
  }

  // Handle Retry Review when AI is unavailable
  async function handleRetryReview() {
    setIsRetryingReview(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/submissions/${submission.id}/review`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to re-run review');
      }

      setAiStatus(data.aiStatus || 'ok');
      if (Array.isArray(data.findings)) {
        setFindings(
          data.findings.sort(
            (a: FindingItem, b: FindingItem) =>
              (SEVERITY_RANK[a.severity] ?? 99) -
              (SEVERITY_RANK[b.severity] ?? 99),
          ),
        );
      }
    } catch (err: any) {
      setActionError(err.message || 'Error retrying review');
    } finally {
      setIsRetryingReview(false);
    }
  }

  // Handle Save New Version
  async function handleSaveNewVersion() {
    setIsSavingVersion(true);
    setSaveVersionMessage(null);
    setActionError(null);

    try {
      const res = await fetch(`/api/submissions/${submission.id}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: workingText }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save new version');
      }

      setCurrentVersionNo((prev) => prev + 1);
      setSaveVersionMessage(
        `Changes saved as Version ${currentVersionNo + 1}!`,
      );
    } catch (err: any) {
      setActionError(err.message || 'Error saving new version');
    } finally {
      setIsSavingVersion(false);
    }
  }

  const pendingCount = findings.filter((f) => f.decision === 'pending').length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 w-full">
      {/* Header with back navigation & title */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/submit"
            className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 mb-2 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Submit</span>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {submission.title}
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border border-border bg-muted/60 text-muted-foreground uppercase">
              {submission.status}
            </span>
            <span className="text-xs font-mono text-muted-foreground">
              v{currentVersionNo}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveNewVersion}
            disabled={isSavingVersion}
            className="gap-1.5"
          >
            <Save className="h-4 w-4" />
            <span>
              {isSavingVersion ? 'Saving...' : 'Save as New Version'}
            </span>
          </Button>
        </div>
      </div>

      {/* AI Unavailable Banner */}
      {aiStatus === 'unavailable' && (
        <div
          role="alert"
          className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 text-amber-900 dark:text-amber-200 shadow-sm"
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-sm font-medium">
              The AI reviewer is unavailable right now, only basic checks ran. You can try again.
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetryReview}
            disabled={isRetryingReview}
            className="shrink-0 border-amber-400 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900 gap-1.5"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRetryingReview ? 'animate-spin' : ''}`}
            />
            <span>{isRetryingReview ? 'Checking...' : 'Try again'}</span>
          </Button>
        </div>
      )}

      {/* Notification banners */}
      {saveVersionMessage && (
        <div className="mb-6 p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-sm flex items-center gap-2">
          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{saveVersionMessage}</span>
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="mb-6 p-3 rounded-md bg-destructive/15 border border-destructive/30 text-destructive text-sm"
        >
          {actionError}
        </div>
      )}

      {/* Two-column layout: Left Content with Highlights / Right Findings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Highlighted Content */}
        <div className="lg:col-span-6 bg-card border border-border rounded-xl p-6 shadow-sm sticky top-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
            <div>
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <FileCheck2 className="h-4 w-4 text-primary" />
                <span>Working Copy</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Issues are tagged with #{' '}&lt;number&gt; matching the finding
                cards.
              </p>
            </div>
            <span className="text-xs font-mono text-muted-foreground">
              {workingText.length.toLocaleString()} characters
            </span>
          </div>

          <div className="font-sans text-sm leading-relaxed whitespace-pre-wrap text-foreground bg-muted/20 p-4 rounded-lg border border-border min-h-[360px] max-h-[680px] overflow-y-auto">
            {renderedContent}
          </div>
        </div>

        {/* Right Side: Findings, high severity first */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Review Findings
              </h2>
              <p className="text-xs text-muted-foreground">
                Sorted by severity (high first). Total: {findings.length}{' '}
                {pendingCount > 0 && `(${pendingCount} pending)`}
              </p>
            </div>
          </div>

          {findings.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-border rounded-xl bg-card">
              <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-foreground">
                No Issues Flagged
              </h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                Your content aligns with brand guidelines and approved facts.
              </p>
            </div>
          ) : (
            numberedFindings.map((finding) => {
              const citation = getCitationInfo(
                finding.rule_code,
                finding.quoted_text,
                rules,
                facts,
                terms,
              );

              return (
                <div
                  key={finding.id}
                  id={`card-${finding.id}`}
                  className={`bg-card border rounded-xl p-5 shadow-sm transition-all space-y-3.5 ${
                    finding.decision === 'accepted'
                      ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/20'
                      : finding.decision === 'edited'
                        ? 'border-blue-300 dark:border-blue-800 bg-blue-50/20'
                        : finding.decision === 'rejected'
                          ? 'border-border/60 opacity-75'
                          : 'border-border'
                  }`}
                >
                  {/* Card Header: Badge with number, severity with text, category, source, confidence */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white select-none">
                        #{finding.findingNumber}
                      </span>

                      {/* Severity badge with text */}
                      {finding.severity === 'high' ? (
                        <span className="px-2.5 py-0.5 text-xs font-semibold rounded bg-red-100 text-red-800 dark:bg-red-950/70 dark:text-red-300 border border-red-300 dark:border-red-800">
                          High Severity
                        </span>
                      ) : finding.severity === 'medium' ? (
                        <span className="px-2.5 py-0.5 text-xs font-semibold rounded bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                          Medium Severity
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 text-xs font-semibold rounded bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                          Low Severity
                        </span>
                      )}

                      <span className="text-xs uppercase font-semibold tracking-wider text-muted-foreground">
                        {finding.category}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* AI Badge for AI findings */}
                      {finding.source === 'ai' && <AiBadge />}

                      {/* Confidence (Shows Needs human judgement when < 0.6) */}
                      {finding.confidence < 0.6 ? (
                        <span
                          title={`Confidence score: ${Math.round(finding.confidence * 100)}%`}
                          className="text-xs font-semibold px-2 py-0.5 rounded bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-300 dark:border-orange-800"
                        >
                          Needs human judgement
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground font-mono">
                          {Math.round(finding.confidence * 100)}% confidence
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quoted Text */}
                  <div className="text-xs bg-muted/40 p-2.5 rounded-md border border-border/80">
                    <span className="font-semibold text-muted-foreground block mb-0.5">
                      Quoted Text:
                    </span>
                    <span className="font-mono text-sm text-foreground bg-amber-100 dark:bg-amber-950/60 px-1 py-0.2 rounded">
                      &quot;{finding.quoted_text}&quot;
                    </span>
                  </div>

                  {/* Explanation */}
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground block mb-0.5">
                      Explanation:
                    </span>
                    <p className="text-sm text-foreground leading-relaxed">
                      {finding.explanation}
                    </p>
                  </div>

                  {/* Cited Rule or Fact Lookup */}
                  <div className="p-3 rounded-md bg-muted/30 border border-border text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <BookOpen className="h-3.5 w-3.5 text-primary" />
                      <span>{citation.code}: {citation.title}</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      {citation.body}
                    </p>
                  </div>

                  {/* Suggestion */}
                  {finding.suggestion && (
                    <div className="text-xs bg-emerald-50/80 dark:bg-emerald-950/30 p-2.5 rounded-md border border-emerald-200 dark:border-emerald-800/80 text-emerald-950 dark:text-emerald-200">
                      <span className="font-semibold text-emerald-800 dark:text-emerald-400 block mb-0.5">
                        Suggestion:
                      </span>
                      <p className="text-sm font-medium">
                        &quot;{finding.suggestion}&quot;
                      </p>
                    </div>
                  )}

                  {/* Decision Actions & Status */}
                  <div className="pt-2 border-t border-border flex flex-col gap-3">
                    {finding.decision === 'accepted' ? (
                      <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        <CheckCircle className="h-4 w-4" />
                        <span>Accepted suggestion applied to working copy</span>
                      </div>
                    ) : finding.decision === 'edited' ? (
                      <div className="flex flex-col gap-1 text-xs text-blue-700 dark:text-blue-400">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <Edit3 className="h-4 w-4" />
                          <span>Custom replacement applied:</span>
                        </div>
                        <p className="font-mono bg-blue-100/60 dark:bg-blue-950/50 p-1.5 rounded text-foreground">
                          &quot;{finding.edited_text}&quot;
                        </p>
                      </div>
                    ) : finding.decision === 'rejected' ? (
                      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5 font-semibold text-destructive">
                          <XCircle className="h-4 w-4" />
                          <span>Rejected</span>
                        </div>
                        <p className="italic">
                          Reason: {finding.decision_note}
                        </p>
                      </div>
                    ) : (
                      /* Pending decision buttons */
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleAccept(finding)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs font-semibold"
                          >
                            Accept
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setActiveEditId(
                                activeEditId === finding.id ? null : finding.id,
                              );
                              setCustomEditText(
                                finding.suggestion || finding.quoted_text,
                              );
                              setActiveRejectId(null);
                            }}
                            className="h-8 text-xs"
                          >
                            Edit
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setActiveRejectId(
                                activeRejectId === finding.id
                                  ? null
                                  : finding.id,
                              );
                              setActiveEditId(null);
                              setRejectNote('');
                            }}
                            className="h-8 text-xs text-destructive hover:bg-destructive/10 border-destructive/30"
                          >
                            Reject
                          </Button>
                        </div>

                        {/* Inline Edit Form */}
                        {activeEditId === finding.id && (
                          <div className="p-3 rounded-md bg-muted/40 border border-border space-y-2 text-xs">
                            <label
                              htmlFor={`edit-input-${finding.id}`}
                              className="font-semibold block text-foreground"
                            >
                              Type your replacement:
                            </label>
                            <input
                              id={`edit-input-${finding.id}`}
                              type="text"
                              value={customEditText}
                              onChange={(e) =>
                                setCustomEditText(e.target.value)
                              }
                              className="w-full p-2 rounded border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                              placeholder="Your custom replacement words..."
                            />
                            <div className="flex items-center gap-2 pt-1">
                              <Button
                                size="sm"
                                onClick={() => handleApplyEdit(finding)}
                                className="h-7 text-xs"
                              >
                                Apply Replacement
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setActiveEditId(null)}
                                className="h-7 text-xs"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Inline Reject Form */}
                        {activeRejectId === finding.id && (
                          <div className="p-3 rounded-md bg-muted/40 border border-border space-y-2 text-xs">
                            <label
                              htmlFor={`reject-note-${finding.id}`}
                              className="font-semibold block text-foreground"
                            >
                              Reason for rejection (required):
                            </label>
                            <input
                              id={`reject-note-${finding.id}`}
                              type="text"
                              value={rejectNote}
                              onChange={(e) => setRejectNote(e.target.value)}
                              className="w-full p-2 rounded border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                              placeholder="e.g. Approved exception from legal / stylistic choice..."
                            />
                            <div className="flex items-center gap-2 pt-1">
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleApplyReject(finding)}
                                className="h-7 text-xs"
                              >
                                Confirm Rejection
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setActiveRejectId(null)}
                                className="h-7 text-xs"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
