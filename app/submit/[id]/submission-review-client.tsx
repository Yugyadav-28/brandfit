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
  Send,
  History,
  RotateCcw,
  Sparkles,
  ShieldAlert,
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
  submission_id?: string;
  version_no: number;
  content: string;
  created_at: string;
}

interface SubmissionReviewClientProps {
  submission: SubmissionData;
  initialVersions: VersionData[];
  initialFindings: FindingItem[];
  rules: RuleItem[];
  facts: FactItem[];
  terms: TermItem[];
  initialAiStatus: 'ok' | 'unavailable';
  reviewerFeedbackNote?: string | null;
}

const SEVERITY_RANK: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function formatVersionDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

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
  initialVersions,
  initialFindings,
  rules,
  facts,
  terms,
  initialAiStatus,
  reviewerFeedbackNote,
}: SubmissionReviewClientProps) {
  const [versions, setVersions] = useState<VersionData[]>(() => {
    return [...initialVersions].sort((a, b) => b.version_no - a.version_no);
  });
  const [selectedVersionId, setSelectedVersionId] = useState<string>(
    initialVersions[0]?.id || '',
  );
  const [workingText, setWorkingText] = useState(
    initialVersions[0]?.content || '',
  );
  const [submissionStatus, setSubmissionStatus] = useState(submission.status);
  const [allFindings, setAllFindings] =
    useState<FindingItem[]>(initialFindings);
  const [aiStatus, setAiStatus] = useState<'ok' | 'unavailable'>(
    initialAiStatus,
  );

  // Async process flags
  const [isRechecking, setIsRechecking] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showHighWarningModal, setShowHighWarningModal] = useState(false);

  // Finding action state
  const [activeEditId, setActiveEditId] = useState<string | null>(null);
  const [customEditText, setCustomEditText] = useState('');
  const [activeRejectId, setActiveRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Identify latest and active versions
  const latestVersion = versions[0];
  const activeVersion =
    versions.find((v) => v.id === selectedVersionId) || latestVersion;
  const isViewingLatest = activeVersion?.id === latestVersion?.id;

  // Active findings for the displayed version
  const displayedFindings = useMemo(() => {
    return allFindings
      .filter((f) => f.version_id === activeVersion.id)
      .sort(
        (a, b) =>
          (SEVERITY_RANK[a.severity] ?? 99) -
          (SEVERITY_RANK[b.severity] ?? 99),
      );
  }, [allFindings, activeVersion.id]);

  // Number findings in order (1, 2, 3...)
  const numberedFindings = useMemo(() => {
    return displayedFindings.map((f, idx) => ({
      ...f,
      findingNumber: idx + 1,
    }));
  }, [displayedFindings]);

  // Pending high severity count on latest version
  const latestFindings = useMemo(() => {
    return allFindings.filter((f) => f.version_id === latestVersion?.id);
  }, [allFindings, latestVersion?.id]);

  const pendingHighFindings = useMemo(() => {
    return latestFindings.filter(
      (f) => f.severity === 'high' && f.decision === 'pending',
    );
  }, [latestFindings]);

  // Text to display in highlighted box
  const contentToHighlight = isViewingLatest
    ? workingText
    : activeVersion.content;

  // Compute non-overlapping highlight spans for first occurrences only
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

    for (const f of numberedFindings) {
      if (!f.quoted_text) continue;
      const startIdx = contentToHighlight.indexOf(f.quoted_text);
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

    // Sort by position
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
  }, [contentToHighlight, numberedFindings]);

  // Render text with <mark> tags and number badges
  const renderedHighlightedContent = useMemo(() => {
    if (highlightSpans.length === 0) {
      return contentToHighlight;
    }

    const fragments: React.ReactNode[] = [];
    let currentPos = 0;

    highlightSpans.forEach((span, idx) => {
      if (span.start > currentPos) {
        fragments.push(contentToHighlight.slice(currentPos, span.start));
      }

      const matchText = contentToHighlight.slice(span.start, span.end);

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

    if (currentPos < contentToHighlight.length) {
      fragments.push(contentToHighlight.slice(currentPos));
    }

    return fragments;
  }, [contentToHighlight, highlightSpans]);

  // Handle Accept finding
  async function handleAccept(finding: FindingItem) {
    if (!isViewingLatest) return;
    setActionError(null);
    setSuccessMessage(null);
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

      // Apply suggestion to working copy (replaces first occurrence)
      setWorkingText((prev) =>
        prev.replace(finding.quoted_text, finding.suggestion),
      );

      // Update finding locally
      setAllFindings((prev) =>
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
    if (!isViewingLatest) return;
    setActionError(null);
    setSuccessMessage(null);
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
      setAllFindings((prev) =>
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
    if (!isViewingLatest) return;
    setActionError(null);
    setSuccessMessage(null);
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
      setAllFindings((prev) =>
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

  // Handle Re-check:
  // Calls POST /api/submissions/[id]/versions with working copy,
  // then calls POST /api/submissions/[id]/review, and shows the new findings.
  async function handleRecheck() {
    setIsRechecking(true);
    setActionError(null);
    setSuccessMessage(null);

    try {
      if (workingText.length > 10000) {
        throw new Error('Working copy exceeds the 10,000 character limit');
      }

      // 1. Create next version
      const verRes = await fetch(
        `/api/submissions/${submission.id}/versions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: workingText }),
        },
      );

      const verData = await verRes.json();
      if (!verRes.ok) {
        throw new Error(verData.error || 'Failed to create new version');
      }

      const newVersionId = verData.versionId;
      const newVersionNo = verData.versionNo;

      // 2. Call review
      const revRes = await fetch(`/api/submissions/${submission.id}/review`, {
        method: 'POST',
      });

      const revData = await revRes.json();
      if (!revRes.ok) {
        throw new Error(revData.error || 'Failed to review new version');
      }

      const newVersionObj: VersionData = {
        id: newVersionId,
        submission_id: submission.id,
        version_no: newVersionNo,
        content: workingText,
        created_at: new Date().toISOString(),
      };

      // Prepend the new version to versions
      setVersions((prev) => [newVersionObj, ...prev]);
      setSelectedVersionId(newVersionId);

      // Replace findings for this version
      const newFindings = Array.isArray(revData.findings)
        ? revData.findings
        : [];
      setAllFindings((prev) => [
        ...prev.filter((f) => f.version_id !== newVersionId),
        ...newFindings,
      ]);

      setAiStatus(revData.aiStatus || 'ok');
      setSubmissionStatus('draft');
      setSuccessMessage(
        `Version ${newVersionNo} created! Re-check complete with ${newFindings.length} issue(s) flagged.`,
      );
    } catch (err: any) {
      setActionError(err.message || 'Error during re-check');
    } finally {
      setIsRechecking(false);
    }
  }

  // Handle Send for review:
  // If any high severity finding is still pending, show confirmation warning (do not block them).
  function handleSendClick() {
    setActionError(null);
    setSuccessMessage(null);

    if (pendingHighFindings.length > 0) {
      setShowHighWarningModal(true);
      return;
    }

    executeSendForReview();
  }

  async function executeSendForReview() {
    setIsSending(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/submissions/${submission.id}/send`, {
        method: 'POST',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send submission for review');
      }

      setSubmissionStatus('in_review');
      setShowHighWarningModal(false);
      setSuccessMessage(
        'Submission sent for review! Status is now In Review.',
      );
    } catch (err: any) {
      setActionError(err.message || 'Error sending submission for review');
    } finally {
      setIsSending(false);
    }
  }

  const pendingCount = displayedFindings.filter(
    (f) => f.decision === 'pending',
  ).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 w-full space-y-6">
      {/* Top Breadcrumb & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <Link
            href="/submit"
            className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 mb-2 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Submit</span>
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {submission.title}
            </h1>
            <span
              className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border uppercase ${
                submissionStatus === 'in_review'
                  ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800'
                  : submissionStatus === 'approved'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800'
                  : 'bg-muted/60 text-muted-foreground border-border'
              }`}
            >
              {submissionStatus.replace('_', ' ')}
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">
              Viewing v{activeVersion.version_no}{' '}
              {isViewingLatest ? '(Latest)' : '(History)'}
            </span>
          </div>
        </div>

        {/* Action Buttons: Re-check & Send for Review */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRecheck}
            disabled={isRechecking || isSending}
            className="gap-2"
          >
            <RotateCcw
              className={`h-3.5 w-3.5 ${isRechecking ? 'animate-spin' : ''}`}
            />
            <span>{isRechecking ? 'Re-checking...' : 'Re-check'}</span>
          </Button>

          <Button
            size="sm"
            onClick={handleSendClick}
            disabled={
              isSending ||
              isRechecking ||
              submissionStatus === 'in_review'
            }
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Send className="h-3.5 w-3.5" />
            <span>
              {submissionStatus === 'in_review'
                ? 'In Review'
                : isSending
                ? 'Sending...'
                : 'Send for review'}
            </span>
          </Button>
        </div>
      </div>

      {/* Version History List (Version 1, Version 2, etc. with date) */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <History className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">
            Version History
          </h2>
          <span className="text-xs text-muted-foreground">
            ({versions.length} total)
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {versions.map((ver) => {
            const isSelected = ver.id === activeVersion.id;
            const isLatest = ver.id === latestVersion.id;

            return (
              <button
                key={ver.id}
                type="button"
                onClick={() => setSelectedVersionId(ver.id)}
                className={`flex flex-col text-left px-3 py-2 rounded-lg border text-xs transition-all shrink-0 min-w-[140px] ${
                  isSelected
                    ? 'border-primary bg-primary/10 text-primary font-medium ring-1 ring-primary'
                    : 'border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="flex items-center justify-between w-full gap-2">
                  <span className="font-semibold text-sm">
                    Version {ver.version_no}
                  </span>
                  {isLatest && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary/20 text-primary font-medium">
                      Latest
                    </span>
                  )}
                </div>
                <span className="text-[11px] opacity-80 mt-1">
                  {formatVersionDate(ver.created_at)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Read-only History Notice */}
      {!isViewingLatest && (
        <div className="flex items-center justify-between gap-3 p-3.5 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/40 dark:border-blue-800 text-blue-900 dark:text-blue-200 text-sm">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-blue-600 shrink-0" />
            <span>
              You are viewing <strong>Version {activeVersion.version_no}</strong>{' '}
              in read-only mode.
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedVersionId(latestVersion.id)}
            className="text-xs border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900"
          >
            Switch to Latest (v{latestVersion.version_no})
          </Button>
        </div>
      )}

      {/* Reviewer Feedback / Changes Requested Banner */}
      {submissionStatus === 'changes_requested' && (
        <div
          role="alert"
          className="p-4 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 text-amber-900 dark:text-amber-200 shadow-sm space-y-2.5"
        >
          <div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-base">Changes Requested by Reviewer</span>
          </div>
          {reviewerFeedbackNote ? (
            <div className="pl-7 space-y-1">
              <span className="text-xs uppercase font-bold text-amber-700 dark:text-amber-400">
                Reviewer Feedback Note:
              </span>
              <blockquote className="text-sm font-medium italic border-l-2 border-amber-400 pl-3 py-1 bg-amber-100/50 dark:bg-amber-900/30 rounded-r text-foreground">
                &ldquo;{reviewerFeedbackNote}&rdquo;
              </blockquote>
            </div>
          ) : (
            <p className="text-sm pl-7 text-muted-foreground">
              The reviewer has requested revisions before approving this submission.
            </p>
          )}
          <p className="text-xs pl-7 text-muted-foreground">
            Edit your working copy below to address the requested changes, click{' '}
            <strong className="text-foreground">&quot;Re-check&quot;</strong> to create a new version, and click{' '}
            <strong className="text-foreground">&quot;Send for review&quot;</strong> to submit again.
          </p>
        </div>
      )}

      {/* AI Unavailable Banner */}
      {aiStatus === 'unavailable' && (
        <div
          role="alert"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 text-amber-900 dark:text-amber-200 shadow-sm"
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-sm font-medium">
              The AI reviewer is unavailable right now, only basic checks ran.
              You can try again.
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRecheck}
            disabled={isRechecking}
            className="shrink-0 border-amber-400 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900 gap-1.5"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRechecking ? 'animate-spin' : ''}`}
            />
            <span>{isRechecking ? 'Re-checking...' : 'Try again'}</span>
          </Button>
        </div>
      )}

      {/* Notifications */}
      {successMessage && (
        <div className="p-3.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-sm flex items-center gap-2">
          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="p-3.5 rounded-md bg-destructive/15 border border-destructive/30 text-destructive text-sm"
        >
          {actionError}
        </div>
      )}

      {/* Two-column layout: Left (Highlighted View + Editable Textarea) / Right (Findings) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Highlighted Content & Editable Working Copy */}
        <div className="lg:col-span-6 space-y-6">
          {/* 1. Highlighted View */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-border">
              <div>
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <FileCheck2 className="h-4 w-4 text-primary" />
                  <span>Highlighted Content</span>
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Issues are tagged with #{' '}&lt;number&gt; matching the
                  findings on the right.
                </p>
              </div>
              <span className="text-xs font-mono text-muted-foreground">
                {contentToHighlight.length.toLocaleString()} chars
              </span>
            </div>

            <div className="font-sans text-sm leading-relaxed whitespace-pre-wrap text-foreground bg-muted/20 p-4 rounded-lg border border-border min-h-[220px] max-h-[420px] overflow-y-auto">
              {renderedHighlightedContent}
            </div>
          </div>

          {/* 2. Working copy editable text area under highlighted view */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="working-copy-textarea"
                className="text-sm font-semibold text-foreground flex items-center gap-2"
              >
                <Edit3 className="h-4 w-4 text-primary" />
                <span>
                  {isViewingLatest
                    ? 'Working Copy (Editable)'
                    : `Version ${activeVersion.version_no} Text (Read-Only)`}
                </span>
              </label>
              <span
                className={`text-xs font-mono ${
                  workingText.length > 10000
                    ? 'text-destructive font-bold'
                    : 'text-muted-foreground'
                }`}
              >
                {workingText.length.toLocaleString()} / 10,000 characters
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              {isViewingLatest
                ? 'Direct edits or accepted suggestions update this draft. Click "Re-check" above to create a new version and re-scan.'
                : `This version is historical and read-only. Switch to Version ${latestVersion.version_no} to edit.`}
            </p>

            <textarea
              id="working-copy-textarea"
              rows={10}
              value={isViewingLatest ? workingText : activeVersion.content}
              onChange={(e) => {
                if (isViewingLatest) {
                  setWorkingText(e.target.value);
                }
              }}
              readOnly={!isViewingLatest}
              disabled={!isViewingLatest}
              className={`w-full rounded-lg border p-3 font-sans text-sm leading-relaxed text-foreground bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-input disabled:cursor-not-allowed disabled:bg-muted/40 transition-colors ${
                workingText.length > 10000
                  ? 'border-destructive focus:ring-destructive'
                  : 'border-input'
              }`}
              placeholder="Enter your content here..."
            />
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
                Sorted by severity (high first). Total: {displayedFindings.length}{' '}
                {pendingCount > 0 && `(${pendingCount} pending)`}
              </p>
            </div>
          </div>

          {displayedFindings.length === 0 ? (
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
                      : finding.decision === 'rejected'
                      ? 'border-muted bg-muted/20 opacity-75'
                      : finding.decision === 'edited'
                      ? 'border-blue-300 dark:border-blue-800 bg-blue-50/20'
                      : 'border-border'
                  }`}
                >
                  {/* Card Header: Severity Badge, Number, Category, AI badge */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center text-xs font-bold px-2 py-0.5 rounded-full bg-amber-600 text-white select-none">
                        #{finding.findingNumber}
                      </span>

                      {/* Severity badge with text */}
                      <span
                        className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${
                          finding.severity === 'high'
                            ? 'bg-destructive/15 text-destructive border-destructive/30'
                            : finding.severity === 'medium'
                            ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-amber-300 dark:border-amber-700'
                            : 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200 border-blue-300 dark:border-blue-700'
                        }`}
                      >
                        {finding.severity} severity
                      </span>

                      <span className="text-xs font-medium text-muted-foreground capitalize">
                        {finding.category}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {finding.source === 'ai' && <AiBadge />}
                      {finding.decision !== 'pending' && (
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded uppercase border ${
                            finding.decision === 'accepted'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200'
                              : finding.decision === 'edited'
                              ? 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-200'
                              : 'bg-muted text-muted-foreground border-border'
                          }`}
                        >
                          {finding.decision}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quoted Text */}
                  <div className="p-2.5 rounded-md bg-muted/40 border border-border/60">
                    <span className="text-[11px] font-semibold text-muted-foreground block uppercase mb-1">
                      Quoted Text
                    </span>
                    <blockquote className="text-sm font-medium text-foreground italic">
                      &ldquo;{finding.quoted_text}&rdquo;
                    </blockquote>
                  </div>

                  {/* Explanation */}
                  <div>
                    <span className="text-[11px] font-semibold text-muted-foreground block uppercase mb-0.5">
                      Explanation
                    </span>
                    <p className="text-sm text-foreground">
                      {finding.explanation}
                    </p>
                  </div>

                  {/* Cited Rule, Fact, or Term */}
                  <div className="p-3 rounded-lg border border-border bg-card/60 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <BookOpen className="h-3.5 w-3.5 text-primary" />
                      <span>Cited: {citation.title}</span>
                      <span className="text-muted-foreground font-mono text-[11px]">
                        ({citation.code})
                      </span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      {citation.body}
                    </p>
                  </div>

                  {/* Suggestion */}
                  <div className="p-2.5 rounded-md bg-primary/5 border border-primary/20">
                    <span className="text-[11px] font-semibold text-primary block uppercase mb-0.5 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      <span>Suggestion</span>
                    </span>
                    <p className="text-sm text-foreground font-medium">
                      {finding.suggestion}
                    </p>
                  </div>

                  {/* Confidence Note */}
                  <div className="text-xs text-muted-foreground flex items-center justify-between">
                    <span>
                      {finding.confidence < 0.6 ? (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                          ⚠️ Needs human judgement
                        </span>
                      ) : (
                        <span>
                          {Math.round(finding.confidence * 100)}% confidence
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Decision details if already decided */}
                  {finding.decision === 'rejected' && (
                    <div className="p-2 rounded bg-muted text-xs text-muted-foreground">
                      <strong>Rejection reason:</strong>{' '}
                      {finding.decision_note || 'No reason specified'}
                    </div>
                  )}

                  {finding.decision === 'edited' && (
                    <div className="p-2 rounded bg-blue-50 dark:bg-blue-950/40 text-xs text-blue-900 dark:text-blue-200">
                      <strong>Custom replacement applied:</strong>{' '}
                      &ldquo;{finding.edited_text}&rdquo;
                    </div>
                  )}

                  {/* Interactive Action Controls (only on latest version) */}
                  {isViewingLatest ? (
                    <div className="pt-2 border-t border-border space-y-2">
                      {/* Default buttons when not editing or rejecting */}
                      {activeEditId !== finding.id &&
                        activeRejectId !== finding.id && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAccept(finding)}
                              className="text-xs gap-1 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                            >
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                              <span>Accept</span>
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setActiveEditId(finding.id);
                                setCustomEditText(finding.suggestion);
                                setActiveRejectId(null);
                              }}
                              className="text-xs gap-1"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              <span>Edit</span>
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setActiveRejectId(finding.id);
                                setRejectNote('');
                                setActiveEditId(null);
                              }}
                              className="text-xs gap-1 text-destructive hover:bg-destructive/10 border-destructive/30"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              <span>Reject</span>
                            </Button>
                          </div>
                        )}

                      {/* Inline Edit Form */}
                      {activeEditId === finding.id && (
                        <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
                          <label className="text-xs font-semibold text-foreground block">
                            Type replacement for &ldquo;{finding.quoted_text}
                            &rdquo;:
                          </label>
                          <input
                            type="text"
                            value={customEditText}
                            onChange={(e) => setCustomEditText(e.target.value)}
                            className="w-full text-xs p-2 rounded border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                            placeholder="Type replacement text..."
                          />
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleApplyEdit(finding)}
                              className="text-xs"
                            >
                              Apply Replacement
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setActiveEditId(null)}
                              className="text-xs"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Inline Reject Form */}
                      {activeRejectId === finding.id && (
                        <div className="space-y-2 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                          <label className="text-xs font-semibold text-foreground block">
                            Reason for rejection (required):
                          </label>
                          <input
                            type="text"
                            value={rejectNote}
                            onChange={(e) => setRejectNote(e.target.value)}
                            className="w-full text-xs p-2 rounded border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                            placeholder="Why is this finding not applicable?"
                          />
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleApplyReject(finding)}
                              className="text-xs"
                            >
                              Confirm Rejection
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setActiveRejectId(null)}
                              className="text-xs"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-border text-xs text-muted-foreground italic">
                      Historical version findings are read-only.
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Confirmation Warning Modal for Pending High-Severity Findings */}
      {showHighWarningModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="warning-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
        >
          <div className="w-full max-w-md bg-card border border-amber-300 dark:border-amber-800 rounded-xl p-6 shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-600 shrink-0">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <h3
                  id="warning-modal-title"
                  className="text-lg font-semibold text-foreground"
                >
                  Unresolved High Severity Findings
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  You have{' '}
                  <strong className="text-destructive font-bold">
                    {pendingHighFindings.length} high-severity issue(s)
                  </strong>{' '}
                  still marked as pending on this submission.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-xs space-y-1 border border-amber-200 dark:border-amber-900">
              <p className="font-medium">
                Sending for review with unresolved critical issues may cause
                brand reviewers to request changes or reject the submission.
              </p>
              <p className="text-muted-foreground">
                You can still send it anyway if you believe these findings are
                acceptable.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHighWarningModal(false)}
                disabled={isSending}
              >
                Go Back & Fix
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={executeSendForReview}
                disabled={isSending}
                className="gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                <span>
                  {isSending ? 'Sending...' : 'Send for Review Anyway'}
                </span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
