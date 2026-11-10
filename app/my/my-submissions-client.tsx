'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingDown,
  Sparkles,
  ExternalLink,
  PlusCircle,
  MessageSquare,
  Building2,
  Calendar,
} from 'lucide-react';

export interface MySubmissionItem {
  id: string;
  title: string;
  status: string;
  company_id: string;
  company_name?: string;
  versionCount: number;
  latestFindingsCount: number;
  updated_at: string;
  created_at: string;
  latestReviewerNote?: string | null;
  latestDecision?: string | null;
}

export interface RuleMistakeStat {
  rule_code: string;
  title: string;
  count: number;
  category?: string;
}

interface MySubmissionsClientProps {
  submissions: MySubmissionItem[];
  topMistakes: RuleMistakeStat[];
  totalFindingsCount: number;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
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

function getStatusBadge(status: string) {
  switch (status) {
    case 'approved':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 uppercase tracking-wider">
          <CheckCircle2 className="h-3 w-3" />
          <span>Approved</span>
        </span>
      );
    case 'changes_requested':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950 dark:text-amber-200 uppercase tracking-wider">
          <AlertTriangle className="h-3 w-3" />
          <span>Changes Requested</span>
        </span>
      );
    case 'in_review':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-950 dark:text-blue-200 uppercase tracking-wider">
          <Clock className="h-3 w-3" />
          <span>In Review</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border uppercase tracking-wider">
          <FileText className="h-3 w-3" />
          <span>Draft</span>
        </span>
      );
  }
}

export function MySubmissionsClient({
  submissions,
  topMistakes,
  totalFindingsCount,
}: MySubmissionsClientProps) {
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredSubmissions =
    filterStatus === 'all'
      ? submissions
      : submissions.filter((s) => s.status === filterStatus);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            My Submissions
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track your submitted drafts, reviewer decisions, and compliance history.
          </p>
        </div>

        <Button asChild className="gap-2">
          <Link href="/submit">
            <PlusCircle className="h-4 w-4" />
            <span>New Submission</span>
          </Link>
        </Button>
      </div>

      {/* "Your mistakes by rule" Section */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-foreground">
              Your mistakes by rule
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">
            {totalFindingsCount > 0
              ? `${totalFindingsCount} total compliance flags across all versions`
              : 'All-time statistics'}
          </span>
        </div>

        <p className="text-xs text-muted-foreground">
          Top rule codes flagged in your submissions. Focus on these guidelines to write cleaner, faster-approved content.
        </p>

        {topMistakes.length === 0 ? (
          <div className="p-6 text-center border border-dashed border-border rounded-lg bg-muted/20">
            <Sparkles className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-foreground">
              No brand mistakes recorded yet!
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              You haven&apos;t triggered any brand rule violations. Keep up the high compliance standard!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            {topMistakes.map((mistake, index) => (
              <div
                key={mistake.rule_code}
                className="p-4 rounded-xl border border-border bg-muted/30 flex flex-col justify-between space-y-3 relative overflow-hidden"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold font-mono">
                      #{index + 1}
                    </span>
                    <span className="font-mono font-bold text-sm text-foreground">
                      {mistake.rule_code}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                    {mistake.count} {mistake.count === 1 ? 'time' : 'times'}
                  </span>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-foreground line-clamp-1">
                    {mistake.title}
                  </h4>
                  {mistake.category && (
                    <span className="text-[11px] text-muted-foreground capitalize mt-0.5 block">
                      Category: {mistake.category}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submissions Table Section */}
      <div className="space-y-4">
        {/* Filter Tabs */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <span>All Submissions ({submissions.length})</span>
          </h2>

          <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-lg border border-border text-xs">
            {['all', 'draft', 'in_review', 'approved', 'changes_requested'].map(
              (st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setFilterStatus(st)}
                  className={`px-3 py-1 rounded-md font-medium capitalize transition-colors ${
                    filterStatus === st
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ),
            )}
          </div>
        </div>

        {filteredSubmissions.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-border rounded-xl bg-card">
            <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-60" />
            <h3 className="text-base font-semibold text-foreground">
              {filterStatus === 'all'
                ? 'No submissions yet'
                : `No submissions with status "${filterStatus.replace('_', ' ')}"`}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              {filterStatus === 'all'
                ? 'Create your first brand post submission to get real-time AI compliance feedback.'
                : 'Try selecting a different filter above or create a new draft.'}
            </p>
            {filterStatus === 'all' && (
              <Button asChild className="mt-4" size="sm">
                <Link href="/submit">Create Submission</Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground border-b border-border">
                  <tr>
                    <th scope="col" className="px-5 py-3.5 font-semibold">
                      Title
                    </th>
                    <th scope="col" className="px-5 py-3.5 font-semibold">
                      Status
                    </th>
                    <th scope="col" className="px-5 py-3.5 font-semibold text-center">
                      Versions
                    </th>
                    <th scope="col" className="px-5 py-3.5 font-semibold text-center">
                      Latest Issues
                    </th>
                    <th scope="col" className="px-5 py-3.5 font-semibold">
                      Last Updated
                    </th>
                    <th scope="col" className="px-5 py-3.5 font-semibold max-w-xs">
                      Reviewer Note
                    </th>
                    <th scope="col" className="px-5 py-3.5 font-semibold text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredSubmissions.map((sub) => (
                    <tr
                      key={sub.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      {/* Title linked to /submit/[id] */}
                      <td className="px-5 py-4">
                        <Link
                          href={`/submit/${sub.id}`}
                          className="font-semibold text-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5"
                        >
                          <span>{sub.title}</span>
                          <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                        </Link>
                        {sub.company_name && (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Building2 className="h-3 w-3" />
                            <span>{sub.company_name}</span>
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        {getStatusBadge(sub.status)}
                      </td>

                      {/* Versions Count */}
                      <td className="px-5 py-4 text-center">
                        <span className="px-2 py-0.5 rounded font-mono text-xs bg-muted text-foreground border border-border">
                          v{sub.versionCount}
                        </span>
                      </td>

                      {/* Number of findings in the latest version */}
                      <td className="px-5 py-4 text-center">
                        <span
                          className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            sub.latestFindingsCount === 0
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                              : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
                          }`}
                        >
                          {sub.latestFindingsCount}
                        </span>
                      </td>

                      {/* Last Updated */}
                      <td className="px-5 py-4 text-xs text-muted-foreground font-mono">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 opacity-70" />
                          <span>{formatDate(sub.updated_at || sub.created_at)}</span>
                        </div>
                      </td>

                      {/* Reviewer Latest Note */}
                      <td className="px-5 py-4 max-w-xs">
                        {sub.latestReviewerNote ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                              <MessageSquare className="h-3 w-3" />
                              <span className="capitalize">
                                {sub.latestDecision
                                  ? sub.latestDecision.replace('_', ' ')
                                  : 'Feedback'}
                                :
                              </span>
                            </div>
                            <p className="text-xs text-foreground italic line-clamp-2 bg-muted/40 p-1.5 rounded border border-border/60">
                              &ldquo;{sub.latestReviewerNote}&rdquo;
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            No notes
                          </span>
                        )}
                      </td>

                      {/* Action Link */}
                      <td className="px-5 py-4 text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/submit/${sub.id}`}>
                            <span>Open</span>
                            <ArrowRight className="h-3 w-3 ml-1" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
