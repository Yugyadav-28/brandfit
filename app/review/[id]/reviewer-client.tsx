'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { AiBadge } from '@/components/ai-badge';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  FileCheck2,
  BookOpen,
  Send,
  MessageSquare,
  History,
  Sparkles,
  ShieldAlert,
  Clock,
  User,
  Check,
  RotateCcw,
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

export interface VersionItem {
  id: string;
  version_no: number;
  content: string;
  created_at: string;
}

export interface CommentItem {
  id: string;
  submission_id: string;
  author_id: string;
  author_display_name?: string;
  author_role?: string;
  body: string;
  created_at: string;
}

export interface ApprovalItem {
  id: string;
  submission_id: string;
  reviewer_id: string;
  decision: string;
  note?: string | null;
  created_at: string;
  reviewer_display_name?: string;
}

export interface SubmissionDetails {
  id: string;
  title: string;
  status: string;
  company_id: string;
  author_id: string;
  author_display_name: string;
  created_at: string;
  updated_at: string;
}

interface ReviewerClientProps {
  submission: SubmissionDetails;
  currentUserId: string;
  currentUserRole: 'reviewer' | 'employer';
  versions: VersionItem[];
  initialFindings: FindingItem[];
  rules: RuleItem[];
  facts: FactItem[];
  terms: TermItem[];
  initialComments: CommentItem[];
  initialApprovals: ApprovalItem[];
}

const SEVERITY_RANK: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
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

export function ReviewerClient({
  submission,
  currentUserId,
  currentUserRole,
  versions,
  initialFindings,
  rules,
  facts,
  terms,
  initialComments,
  initialApprovals,
}: ReviewerClientProps) {
  const [selectedVersionId, setSelectedVersionId] = useState<string>(
    versions[0]?.id || '',
  );
  const [submissionStatus, setSubmissionStatus] = useState<string>(
    submission.status,
  );
  const [comments, setComments] = useState<CommentItem[]>(initialComments);
  const [newCommentText, setNewCommentText] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [approvals, setApprovals] = useState<ApprovalItem[]>(initialApprovals);

  // Decision Modal States
  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false);
  const [decisionType, setDecisionType] = useState<'approved' | 'changes_requested'>('approved');
  const [decisionNote, setDecisionNote] = useState('');
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Active version calculation
  const latestVersion = versions[0];
  const activeVersion =
    versions.find((v) => v.id === selectedVersionId) || latestVersion;
  const isViewingLatest = activeVersion?.id === latestVersion?.id;

  // Active findings for the displayed version
  const displayedFindings = useMemo(() => {
    return initialFindings
      .filter((f) => f.version_id === activeVersion.id)
      .sort(
        (a, b) =>
          (SEVERITY_RANK[a.severity] ?? 99) -
          (SEVERITY_RANK[b.severity] ?? 99),
      );
  }, [initialFindings, activeVersion.id]);

  const numberedFindings = useMemo(() => {
    return displayedFindings.map((f, idx) => ({
      ...f,
      findingNumber: idx + 1,
    }));
  }, [displayedFindings]);

  // Compute non-overlapping highlight spans for first occurrences
  const highlightSpans = useMemo(() => {
    interface Span {
      start: number;
      end: number;
      findingNumber: number;
      findingId: string;
      quoted: string;
    }

    const candidateSpans: Span[] = [];

    for (const f of numberedFindings) {
      if (!f.quoted_text) continue;
      const startIdx = activeVersion.content.indexOf(f.quoted_text);
      if (startIdx !== -1) {
        candidateSpans.push({
          start: startIdx,
          end: startIdx + f.quoted_text.length,
          findingNumber: f.findingNumber,
          findingId: f.id,
          quoted: f.quoted_text,
        });
      }
    }

    candidateSpans.sort((a, b) => a.start - b.start || b.end - a.end);

    const resolved: Span[] = [];
    let lastEnd = 0;

    for (const span of candidateSpans) {
      if (span.start >= lastEnd) {
        resolved.push(span);
        lastEnd = span.end;
      }
    }

    return resolved;
  }, [activeVersion.content, numberedFindings]);

  const renderedContent = useMemo(() => {
    if (highlightSpans.length === 0) {
      return activeVersion.content;
    }

    const fragments: React.ReactNode[] = [];
    let currentPos = 0;

    highlightSpans.forEach((span, idx) => {
      if (span.start > currentPos) {
        fragments.push(activeVersion.content.slice(currentPos, span.start));
      }

      const matchText = activeVersion.content.slice(span.start, span.end);

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

    if (currentPos < activeVersion.content.length) {
      fragments.push(activeVersion.content.slice(currentPos));
    }

    return fragments;
  }, [activeVersion.content, highlightSpans]);

  // Self-approval rule check
  const isOwnSubmission = submission.author_id === currentUserId;
  const canApprove = currentUserRole === 'employer' || !isOwnSubmission;

  // Handle Decision submit (Approve or Request changes)
  async function handleDecisionSubmit(e: React.FormEvent) {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    if (decisionType === 'changes_requested' && !decisionNote.trim()) {
      setActionError('A note explaining requested changes is required');
      return;
    }

    setIsSubmittingDecision(true);
    try {
      const res = await fetch(`/api/submissions/${submission.id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: decisionType,
          note: decisionNote.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to record decision');
      }

      setSubmissionStatus(decisionType);
      if (data.approval) {
        setApprovals((prev) => [data.approval, ...prev]);
      }
      setIsDecisionModalOpen(false);
      setDecisionNote('');
      setActionSuccess(
        decisionType === 'approved'
          ? 'Submission has been approved successfully!'
          : 'Changes have been requested and the author notified.',
      );
    } catch (err: any) {
      setActionError(err.message || 'Error recording decision');
    } finally {
      setIsSubmittingDecision(false);
    }
  }

  // Handle Add Comment
  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    setActionError(null);

    if (!newCommentText.trim()) return;

    setIsPostingComment(true);
    try {
      const res = await fetch(`/api/submissions/${submission.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: newCommentText.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add comment');
      }

      setComments((prev) => [...prev, data.comment]);
      setNewCommentText('');
    } catch (err: any) {
      setActionError(err.message || 'Error posting comment');
    } finally {
      setIsPostingComment(false);
    }
  }

  const latestApproval = approvals[0];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6 w-full">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <Link
            href="/review"
            className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 mb-2 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Review Queue</span>
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {submission.title}
            </h1>
            <span
              className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border uppercase ${
                submissionStatus === 'approved'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200'
                  : submissionStatus === 'changes_requested'
                  ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200'
                  : 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-200'
              }`}
            >
              {submissionStatus.replace('_', ' ')}
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">
              v{activeVersion.version_no}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
            <span>Author: <strong>{submission.author_display_name}</strong></span>
            <span>•</span>
            <span>Submitted: {formatDate(submission.created_at)}</span>
          </p>
        </div>

        {/* Action Controls: Approve & Request changes */}
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDecisionType('changes_requested');
              setDecisionNote('');
              setIsDecisionModalOpen(true);
            }}
            disabled={isSubmittingDecision}
            className="gap-1.5 text-amber-600 border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Request changes</span>
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setDecisionType('approved');
              setDecisionNote('');
              setIsDecisionModalOpen(true);
            }}
            disabled={!canApprove || isSubmittingDecision}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            title={
              !canApprove
                ? 'Reviewers cannot approve their own submissions unless they are an employer'
                : undefined
            }
          >
            <Check className="h-4 w-4" />
            <span>Approve</span>
          </Button>
        </div>
      </div>

      {/* Self-approval disclaimer if applicable */}
      {isOwnSubmission && currentUserRole === 'reviewer' && (
        <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
          <span>
            You are the author of this submission. Under brand governance
            policies, a reviewer cannot approve their own submission unless they
            are an employer.
          </span>
        </div>
      )}

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-3.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-sm flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{actionSuccess}</span>
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

      {/* Latest Decision details if decided */}
      {latestApproval && (
        <div className="p-4 rounded-xl border border-border bg-card/60 space-y-1 text-sm">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold text-foreground uppercase tracking-wider">
              Latest Decision: {latestApproval.decision.replace('_', ' ')}
            </span>
            <span>{formatDate(latestApproval.created_at)}</span>
          </div>
          {latestApproval.note && (
            <p className="text-foreground text-sm pt-1 italic">
              &ldquo;{latestApproval.note}&rdquo;
            </p>
          )}
        </div>
      )}

      {/* Version History List */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <History className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">
            Version History
          </h2>
          <span className="text-xs text-muted-foreground">
            ({versions.length} versions)
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
                  {formatDate(ver.created_at)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Two-column layout: Left Content with Highlights / Right Findings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Version Content with Highlights */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm sticky top-6">
            <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-border">
              <div>
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <FileCheck2 className="h-4 w-4 text-primary" />
                  <span>Version {activeVersion.version_no} Content</span>
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Quoted issue text is highlighted with matching finding badge
                  numbers.
                </p>
              </div>
              <span className="text-xs font-mono text-muted-foreground">
                {activeVersion.content.length.toLocaleString()} chars
              </span>
            </div>

            <div className="font-sans text-sm leading-relaxed whitespace-pre-wrap text-foreground bg-muted/20 p-4 rounded-lg border border-border min-h-[340px] max-h-[640px] overflow-y-auto">
              {renderedContent}
            </div>
          </div>
        </div>

        {/* Right Side: Findings with Author Decisions */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Findings & Author Actions
              </h2>
              <p className="text-xs text-muted-foreground">
                Sorted by severity (high first). Total: {displayedFindings.length}
              </p>
            </div>
          </div>

          {displayedFindings.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-border rounded-xl bg-card">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-foreground">
                No Issues Flagged
              </h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                No brand compliance findings were recorded for this version.
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
                  className="bg-card border rounded-xl p-5 shadow-sm transition-all space-y-3.5 border-border"
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center text-xs font-bold px-2 py-0.5 rounded-full bg-amber-600 text-white select-none">
                        #{finding.findingNumber}
                      </span>

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

                  {/* Cited Rule or Fact */}
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

                  {/* Author Decision Display */}
                  <div className="pt-2 border-t border-border">
                    <span className="text-[11px] font-semibold text-muted-foreground block uppercase mb-1.5">
                      Author Decision
                    </span>
                    {finding.decision === 'accepted' && (
                      <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>Author accepted the recommended suggestion.</span>
                      </div>
                    )}
                    {finding.decision === 'edited' && (
                      <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-200 space-y-1">
                        <span className="font-semibold block">Author edited with custom replacement:</span>
                        <blockquote className="italic font-medium">
                          &ldquo;{finding.edited_text}&rdquo;
                        </blockquote>
                      </div>
                    )}
                    {finding.decision === 'rejected' && (
                      <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive space-y-1">
                        <span className="font-semibold block">Author rejected this finding:</span>
                        <p className="italic">
                          Rejection Reason: &ldquo;{finding.decision_note || 'No reason provided'}&rdquo;
                        </p>
                      </div>
                    )}
                    {finding.decision === 'pending' && (
                      <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                        <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                        <span>Pending author review.</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Comments Thread Section */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">
              Comments & Discussion
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border font-semibold">
              {comments.length}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            Visible to author, reviewers, and employers
          </span>
        </div>

        {/* Existing Comments List */}
        <div className="space-y-4">
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No comments yet on this submission. Start the discussion below.
            </p>
          ) : (
            comments.map((c) => (
              <div
                key={c.id}
                className="p-4 rounded-xl border border-border bg-muted/20 space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-semibold text-foreground">
                      {c.author_display_name || 'Member'}
                    </span>
                    {c.author_role && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] uppercase font-mono bg-muted text-muted-foreground border border-border">
                        {c.author_role}
                      </span>
                    )}
                  </div>
                  <span className="text-muted-foreground font-mono">
                    {formatDate(c.created_at)}
                  </span>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed pt-1">
                  {c.body}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Add Comment Form */}
        <form onSubmit={handleAddComment} className="space-y-3 pt-2">
          <label
            htmlFor="new-comment"
            className="text-xs font-semibold text-foreground block uppercase tracking-wider"
          >
            Add a comment
          </label>
          <textarea
            id="new-comment"
            rows={3}
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            placeholder="Write a message or question regarding this submission..."
            className="w-full text-sm p-3 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex items-center justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={isPostingComment || !newCommentText.trim()}
              className="gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{isPostingComment ? 'Posting...' : 'Post Comment'}</span>
            </Button>
          </div>
        </form>
      </div>

      {/* Decision Modal (Approve or Request changes) */}
      {isDecisionModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg bg-card border border-border rounded-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">
                {decisionType === 'approved'
                  ? 'Approve Submission'
                  : 'Request Changes'}
              </h3>
              <button
                type="button"
                onClick={() => setIsDecisionModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleDecisionSubmit} className="space-y-4">
              {decisionType === 'approved' ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Approving will update this submission&apos;s status to{' '}
                    <strong className="text-emerald-600">Approved</strong>.
                  </p>
                  <label
                    htmlFor="approval-note"
                    className="text-xs font-semibold text-foreground block"
                  >
                    Optional reviewer note:
                  </label>
                  <textarea
                    id="approval-note"
                    rows={3}
                    value={decisionNote}
                    onChange={(e) => setDecisionNote(e.target.value)}
                    placeholder="Add an optional comment or sign-off note..."
                    className="w-full text-xs p-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Requesting changes will notify the author and update the
                    status to{' '}
                    <strong className="text-amber-600">
                      Changes Requested
                    </strong>
                    .
                  </p>
                  <label
                    htmlFor="changes-note"
                    className="text-xs font-semibold text-foreground block"
                  >
                    Feedback note (required):
                  </label>
                  <textarea
                    id="changes-note"
                    rows={4}
                    value={decisionNote}
                    onChange={(e) => setDecisionNote(e.target.value)}
                    required
                    placeholder="Explain what needs to be changed before this content can be approved..."
                    className="w-full text-xs p-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDecisionModalOpen(false)}
                  disabled={isSubmittingDecision}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingDecision}
                  className={
                    decisionType === 'approved'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-amber-600 hover:bg-amber-700 text-white'
                  }
                >
                  {isSubmittingDecision
                    ? 'Submitting...'
                    : decisionType === 'approved'
                    ? 'Confirm Approval'
                    : 'Submit Request for Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
