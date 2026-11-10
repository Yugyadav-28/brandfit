'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  ShieldCheck,
  Building2,
  Calendar,
  User,
  ChevronDown,
  ChevronRight,
  Filter,
  Activity,
  FileCheck2,
} from 'lucide-react';

export interface AuditLogRow {
  id: string;
  company_id: string;
  user_id: string;
  user_name: string;
  action: string;
  plainAction: string;
  detail: Record<string, any>;
  formattedDetail: string;
  created_at: string;
}

export interface CompanyOption {
  companyId: string;
  companyName: string;
}

interface AuditClientProps {
  logs: AuditLogRow[];
  companies: CompanyOption[];
  activeCompanyId: string;
}

function formatAuditTimestamp(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function getActionBadge(action: string, plainAction: string) {
  let badgeStyle =
    'bg-muted text-muted-foreground border-border';

  if (action === 'approved' || action === 'company_created') {
    badgeStyle =
      'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800';
  } else if (
    action === 'changes_requested' ||
    action === 'sent_for_review' ||
    action === 'review_run'
  ) {
    badgeStyle =
      'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800';
  } else if (
    action === 'member_joined' ||
    action === 'role_changed' ||
    action === 'comment_added'
  ) {
    badgeStyle =
      'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800';
  } else if (
    action === 'member_removed' ||
    action === 'rule_deleted'
  ) {
    badgeStyle =
      'bg-destructive/15 text-destructive border-destructive/30';
  } else if (
    action === 'rule_saved' ||
    action === 'fact_saved' ||
    action === 'term_saved' ||
    action === 'finding_decided'
  ) {
    badgeStyle =
      'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-200 dark:border-purple-800';
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize whitespace-nowrap ${badgeStyle}`}
    >
      {plainAction}
    </span>
  );
}

export function AuditClient({
  logs,
  companies,
  activeCompanyId,
}: AuditClientProps) {
  const router = useRouter();
  const [filterAction, setFilterAction] = useState<string>('all');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const activeCompany =
    companies.find((c) => c.companyId === activeCompanyId) || companies[0];

  const uniqueActions = Array.from(new Set(logs.map((l) => l.action))).sort();

  const filteredLogs =
    filterAction === 'all'
      ? logs
      : logs.filter((l) => l.action === filterAction);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <ShieldCheck className="h-7 w-7 text-primary" />
              <span>Company Audit Log</span>
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-primary/10 text-primary border border-primary/20">
              Employer Only
            </span>
          </div>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Building2 className="h-4 w-4" />
            <span>Workspace: <strong>{activeCompany?.companyName}</strong></span>
          </p>
        </div>

        {/* Company Switcher if user is employer in multiple companies */}
        {companies.length > 1 && (
          <div className="flex items-center gap-2">
            <label htmlFor="audit-company-select" className="text-xs text-muted-foreground">
              Switch company:
            </label>
            <select
              id="audit-company-select"
              value={activeCompanyId}
              onChange={(e) =>
                router.push(`/company/audit?companyId=${e.target.value}`)
              }
              className="text-xs rounded-md border border-input bg-background px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {companies.map((c) => (
                <option key={c.companyId} value={c.companyId}>
                  {c.companyName}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Summary & Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border p-4 rounded-xl shadow-sm">
        <div className="flex items-center gap-2 text-sm text-foreground">
          <Activity className="h-4 w-4 text-primary" />
          <span className="font-medium">
            Showing latest {filteredLogs.length} events
          </span>
          <span className="text-xs text-muted-foreground">
            (up to 100 logged events)
          </span>
        </div>

        {/* Action Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <label htmlFor="action-filter" className="text-xs text-muted-foreground">
            Filter by action:
          </label>
          <select
            id="action-filter"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="text-xs rounded-md border border-input bg-background px-2.5 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">All Actions</option>
            {uniqueActions.map((act) => (
              <option key={act} value={act}>
                {act.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table of Latest 100 Audit Log Rows */}
      {filteredLogs.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-border rounded-xl bg-card">
          <FileCheck2 className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-60" />
          <h3 className="text-base font-semibold text-foreground">
            No audit log records found
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            {filterAction === 'all'
              ? 'Activity events in this company workspace will appear here automatically.'
              : `No events matching "${filterAction.replace('_', ' ')}".`}
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground border-b border-border">
                <tr>
                  <th scope="col" className="px-5 py-3.5 font-semibold">
                    Timestamp
                  </th>
                  <th scope="col" className="px-5 py-3.5 font-semibold">
                    Person Name
                  </th>
                  <th scope="col" className="px-5 py-3.5 font-semibold">
                    Action
                  </th>
                  <th scope="col" className="px-5 py-3.5 font-semibold">
                    Details
                  </th>
                  <th scope="col" className="px-5 py-3.5 font-semibold text-right">
                    Raw
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLogs.map((log) => {
                  const isExpanded = expandedRowId === log.id;

                  return (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-muted/30 transition-colors">
                        {/* Time */}
                        <td className="px-5 py-3.5 text-xs font-mono text-muted-foreground whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 opacity-60" />
                            <span>{formatAuditTimestamp(log.created_at)}</span>
                          </div>
                        </td>

                        {/* Person Name */}
                        <td className="px-5 py-3.5 text-foreground font-medium">
                          <div className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{log.user_name}</span>
                          </div>
                        </td>

                        {/* Action in plain words */}
                        <td className="px-5 py-3.5">
                          {getActionBadge(log.action, log.plainAction)}
                        </td>

                        {/* Details */}
                        <td className="px-5 py-3.5 text-xs text-foreground max-w-md">
                          <p className="line-clamp-2 leading-relaxed">
                            {log.formattedDetail}
                          </p>
                        </td>

                        {/* Expand/Collapse JSON toggle */}
                        <td className="px-5 py-3.5 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setExpandedRowId(isExpanded ? null : log.id)
                            }
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 mr-1" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 mr-1" />
                            )}
                            <span>{isExpanded ? 'Hide' : 'Inspect'}</span>
                          </Button>
                        </td>
                      </tr>

                      {/* Expanded Raw Detail Drawer */}
                      {isExpanded && (
                        <tr className="bg-muted/20">
                          <td colSpan={5} className="px-6 py-3 border-t border-dashed border-border">
                            <div className="space-y-1">
                              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                                Raw Event Details (JSON)
                              </span>
                              <pre className="p-3 rounded-lg bg-background border border-border text-[11px] font-mono text-foreground overflow-x-auto">
                                {JSON.stringify(log.detail, null, 2)}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
