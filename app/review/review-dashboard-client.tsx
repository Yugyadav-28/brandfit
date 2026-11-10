'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  ClipboardList,
  AlertCircle,
  Building2,
  User,
  Calendar,
} from 'lucide-react';

export interface ReviewSubmissionItem {
  id: string;
  title: string;
  author_id: string;
  author_name: string;
  status: string;
  created_at: string;
  updated_at: string;
  totalFindings: number;
  acceptedCount: number;
  editedCount: number;
  rejectedCount: number;
  pendingCount: number;
}

export interface CompanyOption {
  companyId: string;
  companyName: string;
  role: string;
}

interface ReviewDashboardClientProps {
  companies: CompanyOption[];
  activeCompanyId: string;
  inReviewSubmissions: ReviewSubmissionItem[];
  decidedSubmissions: ReviewSubmissionItem[];
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

export function ReviewDashboardClient({
  companies,
  activeCompanyId,
  inReviewSubmissions,
  decidedSubmissions,
}: ReviewDashboardClientProps) {
  const router = useRouter();
  const [isDecidedExpanded, setIsDecidedExpanded] = useState(false);

  const activeCompany =
    companies.find((c) => c.companyId === activeCompanyId) || companies[0];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 w-full">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Review Queue
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-primary/10 text-primary border border-primary/20 capitalize">
              {activeCompany?.role || 'Reviewer'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Building2 className="h-4 w-4" />
            <span>Workspace: <strong>{activeCompany?.companyName}</strong></span>
          </p>
        </div>

        {/* Company Switcher if user has multiple reviewer companies */}
        {companies.length > 1 && (
          <div className="flex items-center gap-2">
            <label htmlFor="company-select" className="text-xs text-muted-foreground">
              Switch company:
            </label>
            <select
              id="company-select"
              value={activeCompanyId}
              onChange={(e) => router.push(`/review?companyId=${e.target.value}`)}
              className="text-xs rounded-md border border-input bg-background px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {companies.map((c) => (
                <option key={c.companyId} value={c.companyId}>
                  {c.companyName} ({c.role})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Main Section: Submissions In Review */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-foreground">
              Awaiting Brand Review
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 font-semibold border border-amber-300 dark:border-amber-800">
              {inReviewSubmissions.length}
            </span>
          </div>
        </div>

        {inReviewSubmissions.length === 0 ? (
          <div className="p-10 text-center border border-dashed border-border rounded-xl bg-card">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-foreground">
              All caught up!
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              There are no submissions currently waiting for review in this
              company workspace.
            </p>
          </div>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground border-b border-border">
                  <tr>
                    <th scope="col" className="px-5 py-3.5 font-semibold">
                      Submission Title
                    </th>
                    <th scope="col" className="px-5 py-3.5 font-semibold">
                      Author
                    </th>
                    <th scope="col" className="px-5 py-3.5 font-semibold">
                      Submitted Date
                    </th>
                    <th scope="col" className="px-5 py-3.5 font-semibold text-center">
                      Total Issues
                    </th>
                    <th scope="col" className="px-5 py-3.5 font-semibold">
                      Author Decisions
                    </th>
                    <th scope="col" className="px-5 py-3.5 font-semibold text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {inReviewSubmissions.map((sub) => (
                    <tr
                      key={sub.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      {/* Title */}
                      <td className="px-5 py-4">
                        <Link
                          href={`/review/${sub.id}`}
                          className="font-semibold text-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5"
                        >
                          <span>{sub.title}</span>
                          <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                        </Link>
                      </td>

                      {/* Author */}
                      <td className="px-5 py-4 text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 opacity-70" />
                          <span>{sub.author_name}</span>
                        </div>
                      </td>

                      {/* Submitted Date */}
                      <td className="px-5 py-4 text-muted-foreground text-xs font-mono">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 opacity-70" />
                          <span>{formatDate(sub.updated_at || sub.created_at)}</span>
                        </div>
                      </td>

                      {/* Finding Count */}
                      <td className="px-5 py-4 text-center">
                        <span
                          className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            sub.totalFindings > 0
                              ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
                              : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
                          }`}
                        >
                          {sub.totalFindings}
                        </span>
                      </td>

                      {/* Author Decisions breakdown: accepted, edited, rejected */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          <span
                            title="Accepted suggestions"
                            className="inline-flex items-center px-2 py-0.5 rounded font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                          >
                            ✓ {sub.acceptedCount} accepted
                          </span>
                          <span
                            title="Custom edited text"
                            className="inline-flex items-center px-2 py-0.5 rounded font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                          >
                            ✎ {sub.editedCount} edited
                          </span>
                          <span
                            title="Rejected findings"
                            className="inline-flex items-center px-2 py-0.5 rounded font-medium bg-muted text-muted-foreground border border-border"
                          >
                            ✕ {sub.rejectedCount} rejected
                          </span>
                          {sub.pendingCount > 0 && (
                            <span
                              title="Pending findings"
                              className="inline-flex items-center px-1.5 py-0.5 rounded font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200"
                            >
                              {sub.pendingCount} pending
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-5 py-4 text-right">
                        <Button asChild size="sm">
                          <Link href={`/review/${sub.id}`}>Review</Link>
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

      {/* Collapsed List of Recently Decided Submissions */}
      <div className="border border-border rounded-xl bg-card overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => setIsDecidedExpanded(!isDecidedExpanded)}
          className="w-full flex items-center justify-between p-4 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
          aria-expanded={isDecidedExpanded}
        >
          <div className="flex items-center gap-2">
            {isDecidedExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <ClipboardList className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              Recently Decided Submissions
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
              {decidedSubmissions.length}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {isDecidedExpanded ? 'Click to collapse' : 'Click to expand'}
          </span>
        </button>

        {isDecidedExpanded && (
          <div className="p-4 border-t border-border">
            {decidedSubmissions.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 text-center">
                No decided submissions found for this company.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-muted-foreground border-b border-border uppercase">
                    <tr>
                      <th className="pb-2 font-semibold">Title</th>
                      <th className="pb-2 font-semibold">Author</th>
                      <th className="pb-2 font-semibold">Status</th>
                      <th className="pb-2 font-semibold">Decided Date</th>
                      <th className="pb-2 font-semibold text-right">View</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {decidedSubmissions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-muted/20">
                        <td className="py-2.5 font-medium text-foreground">
                          <Link
                            href={`/review/${sub.id}`}
                            className="hover:underline text-primary font-semibold"
                          >
                            {sub.title}
                          </Link>
                        </td>
                        <td className="py-2.5 text-muted-foreground">
                          {sub.author_name}
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border uppercase ${
                              sub.status === 'approved'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200'
                                : 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200'
                            }`}
                          >
                            {sub.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-2.5 font-mono text-muted-foreground">
                          {formatDate(sub.updated_at || sub.created_at)}
                        </td>
                        <td className="py-2.5 text-right">
                          <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                            <Link href={`/review/${sub.id}`}>Details</Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
