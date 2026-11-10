import { Suspense } from 'react';
import Link from 'next/link';
import { requireUser, requireMember, getMyMemberships } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { Button } from '@/components/ui/button';
import {
  AuditClient,
  AuditLogRow,
  CompanyOption,
} from './audit-client';

interface AuditPageProps {
  searchParams: Promise<{ companyId?: string }>;
}

function getPlainAction(action: string): string {
  const actionMap: Record<string, string> = {
    company_created: 'Company Created',
    member_joined: 'Member Joined',
    role_changed: 'Role Changed',
    member_removed: 'Member Removed',
    rule_saved: 'Brand Rule Saved',
    rule_deleted: 'Brand Rule Deleted',
    fact_saved: 'Brand Fact Saved',
    term_saved: 'Brand Term Saved',
    submission_created: 'Submission Created',
    review_run: 'Automated Review Run',
    finding_decided: 'Finding Decided',
    sent_for_review: 'Sent for Review',
    approved: 'Submission Approved',
    changes_requested: 'Changes Requested',
    comment_added: 'Comment Added',
  };
  return actionMap[action] || action.replace(/_/g, ' ');
}

function formatDetail(action: string, detail: any): string {
  if (!detail || typeof detail !== 'object') return 'No details recorded';

  switch (action) {
    case 'company_created':
      return `Created company "${detail.company_name || ''}" with join code ${detail.join_code || ''}`;
    case 'member_joined':
      return `${detail.display_name || 'Member'} joined with role ${detail.role || 'employee'}`;
    case 'role_changed':
      return `Changed role of ${detail.display_name || 'member'} from ${detail.old_role} to ${detail.new_role}`;
    case 'member_removed':
      return `Removed member ${detail.display_name || ''} (${detail.role || ''})`;
    case 'rule_saved':
      return `Rule ${detail.code || ''}: "${detail.title || ''}" (${detail.category || ''})`;
    case 'rule_deleted':
      return `Deleted rule ${detail.code || ''}`;
    case 'fact_saved':
      return detail.deleted
        ? `Deleted fact ${detail.code || ''}`
        : `Fact ${detail.code || ''}: "${detail.statement || ''}"`;
    case 'term_saved':
      return detail.deleted
        ? `Deleted term "${detail.preferred || ''}"`
        : `Preferred "${detail.preferred || ''}" (Avoid: "${detail.avoid || ''}")`;
    case 'submission_created':
      return `Created submission "${detail.title || ''}"`;
    case 'review_run':
      return `Scanned content with brand kit — flagged ${detail.count ?? 0} issue(s)`;
    case 'finding_decided':
      return `Finding decision: ${detail.decision}${detail.note ? ` (Reason: "${detail.note}")` : ''}`;
    case 'sent_for_review':
      return `Submission "${detail.title || ''}" sent for reviewer sign-off`;
    case 'approved':
      return `Approved submission "${detail.title || ''}"${detail.note ? ` — Note: "${detail.note}"` : ''}`;
    case 'changes_requested':
      return `Requested revisions on "${detail.title || ''}" — Note: "${detail.note || ''}"`;
    case 'comment_added':
      return `Added comment on submission`;
    default:
      return JSON.stringify(detail);
  }
}

async function AuditContent({ searchParams }: AuditPageProps) {
  const user = await requireUser();
  const allMemberships = await getMyMemberships();
  const { companyId } = await searchParams;

  // Filter for employer memberships only
  const employerMemberships = allMemberships.filter(
    (m) => m.role === 'employer',
  );

  if (employerMemberships.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-destructive mb-2">
          Access Restricted
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          The company audit log is restricted to company employers. You do not
          have employer permissions in any company.
        </p>
        <Button asChild variant="outline">
          <Link href="/dashboard">Return to Dashboard</Link>
        </Button>
      </div>
    );
  }

  const selectedCompanyId =
    companyId && employerMemberships.some((m) => m.companyId === companyId)
      ? companyId
      : employerMemberships[0].companyId;

  // Strict role check: employer only
  await requireMember(selectedCompanyId, 'employer');

  const admin = createAdminClient();

  // 1. Fetch latest 100 audit_log rows for this company
  const { data: auditData, error: auditError } = await admin
    .from('audit_log')
    .select('*')
    .eq('company_id', selectedCompanyId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (auditError) {
    console.error('Error fetching audit log:', auditError);
  }

  // 2. Fetch member display names for this company
  const { data: companyMembers } = await admin
    .from('memberships')
    .select('user_id, display_name, role')
    .eq('company_id', selectedCompanyId);

  const memberMap = new Map(
    (companyMembers ?? []).map((m) => [m.user_id, m.display_name || 'Member']),
  );

  const rawLogs = auditData ?? [];

  const formattedLogs: AuditLogRow[] = rawLogs.map((log) => ({
    id: log.id,
    company_id: log.company_id,
    user_id: log.user_id,
    user_name: memberMap.get(log.user_id) || 'Unknown Person',
    action: log.action,
    plainAction: getPlainAction(log.action),
    detail: log.detail ?? {},
    formattedDetail: formatDetail(log.action, log.detail),
    created_at: log.created_at,
  }));

  const companies: CompanyOption[] = employerMemberships.map((m) => ({
    companyId: m.companyId,
    companyName: m.displayName || m.name || m.companyId,
  }));

  return (
    <AuditClient
      logs={formattedLogs}
      companies={companies}
      activeCompanyId={selectedCompanyId}
    />
  );
}

export default function AuditPage(props: AuditPageProps) {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 py-16 text-center text-sm text-muted-foreground">
          Loading audit log...
        </div>
      }
    >
      <AuditContent {...props} />
    </Suspense>
  );
}
