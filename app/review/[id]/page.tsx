import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { requireUser, requireMember } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  ReviewerClient,
  FindingItem,
  RuleItem,
  FactItem,
  TermItem,
  VersionItem,
  CommentItem,
  ApprovalItem,
} from './reviewer-client';

interface ReviewDetailsProps {
  params: Promise<{ id: string }>;
}

async function ReviewDetailsContent({ params }: ReviewDetailsProps) {
  const { id } = await params;
  const user = await requireUser();
  const admin = createAdminClient();

  // 1. Fetch submission
  const { data: submission, error: subError } = await admin
    .from('submissions')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (subError || !submission) {
    notFound();
  }

  // 2. Strict role check: reviewer or employer
  const { role } = await requireMember(submission.company_id, [
    'reviewer',
    'employer',
  ]);

  // 3. Fetch all versions for this submission, newest first
  const { data: allVersions, error: verError } = await admin
    .from('versions')
    .select('*')
    .eq('submission_id', id)
    .order('version_no', { ascending: false });

  if (verError || !allVersions || allVersions.length === 0) {
    notFound();
  }

  const versionIds = allVersions.map((v) => v.id);

  // 4. Fetch findings for all versions
  const { data: findingsData, error: findError } = await admin
    .from('findings')
    .select('*')
    .in('version_id', versionIds);

  if (findError) {
    console.error('Error fetching findings for review details:', findError);
  }

  // 5. Fetch rules, facts, terms for citations
  const [rulesRes, factsRes, termsRes, membersRes, commentsRes, approvalsRes] =
    await Promise.all([
      admin.from('rules').select('*').eq('company_id', submission.company_id),
      admin.from('facts').select('*').eq('company_id', submission.company_id),
      admin.from('terms').select('*').eq('company_id', submission.company_id),
      admin
        .from('memberships')
        .select('user_id, display_name, role')
        .eq('company_id', submission.company_id),
      admin
        .from('comments')
        .select('*')
        .eq('submission_id', id)
        .order('created_at', { ascending: true }),
      admin
        .from('approvals')
        .select('*')
        .eq('submission_id', id)
        .order('created_at', { ascending: false }),
    ]);

  const memberMap = new Map(
    (membersRes.data ?? []).map((m) => [m.user_id, m]),
  );

  const authorMember = memberMap.get(submission.author_id);
  const authorDisplayName = authorMember?.display_name || 'Author';

  const enrichedComments: CommentItem[] = (commentsRes.data ?? []).map((c) => {
    const mem = memberMap.get(c.author_id);
    return {
      ...c,
      author_display_name: mem?.display_name || 'Member',
      author_role: mem?.role || 'employee',
    };
  });

  const enrichedApprovals: ApprovalItem[] = (approvalsRes.data ?? []).map((a) => {
    const mem = memberMap.get(a.reviewer_id);
    return {
      ...a,
      reviewer_display_name: mem?.display_name || 'Reviewer',
    };
  });

  const rules = (rulesRes.data ?? []) as RuleItem[];
  const facts = (factsRes.data ?? []) as FactItem[];
  const terms = (termsRes.data ?? []) as TermItem[];
  const findings = (findingsData ?? []) as FindingItem[];
  const versions = allVersions as VersionItem[];

  return (
    <ReviewerClient
      submission={{
        id: submission.id,
        title: submission.title,
        status: submission.status,
        company_id: submission.company_id,
        author_id: submission.author_id,
        author_display_name: authorDisplayName,
        created_at: submission.created_at,
        updated_at: submission.updated_at,
      }}
      currentUserId={user.id}
      currentUserRole={role as 'reviewer' | 'employer'}
      versions={versions}
      initialFindings={findings}
      rules={rules}
      facts={facts}
      terms={terms}
      initialComments={enrichedComments}
      initialApprovals={enrichedApprovals}
    />
  );
}

export default function ReviewDetailsPage(props: ReviewDetailsProps) {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 py-16 text-center text-sm text-muted-foreground">
          Loading submission for review...
        </div>
      }
    >
      <ReviewDetailsContent {...props} />
    </Suspense>
  );
}
