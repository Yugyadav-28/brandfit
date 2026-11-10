import { Suspense } from 'react';
import Link from 'next/link';
import { requireUser, requireMember, getMyMemberships } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { Button } from '@/components/ui/button';
import {
  ReviewDashboardClient,
  ReviewSubmissionItem,
  CompanyOption,
} from './review-dashboard-client';

interface ReviewPageProps {
  searchParams: Promise<{ companyId?: string }>;
}

async function ReviewContent({ searchParams }: ReviewPageProps) {
  const user = await requireUser();
  const allMemberships = await getMyMemberships();
  const { companyId } = await searchParams;

  // Filter for reviewer or employer memberships
  const reviewerMemberships = allMemberships.filter(
    (m) => m.role === 'reviewer' || m.role === 'employer',
  );

  if (reviewerMemberships.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-destructive mb-2">
          Access Restricted
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          The reviewer queue is only accessible to reviewers and employers. You
          do not have reviewer permissions in any company.
        </p>
        <Button asChild variant="outline">
          <Link href="/dashboard">Return to Dashboard</Link>
        </Button>
      </div>
    );
  }

  const selectedCompanyId =
    companyId && reviewerMemberships.some((m) => m.companyId === companyId)
      ? companyId
      : reviewerMemberships[0].companyId;

  // Strict role check for this company
  await requireMember(selectedCompanyId, ['reviewer', 'employer']);

  const admin = createAdminClient();

  // 1. Fetch in_review submissions
  const { data: inReviewData, error: inReviewError } = await admin
    .from('submissions')
    .select('*')
    .eq('company_id', selectedCompanyId)
    .eq('status', 'in_review')
    .order('updated_at', { ascending: false });

  if (inReviewError) {
    console.error('Error fetching in_review submissions:', inReviewError);
  }

  // 2. Fetch recently decided submissions (approved or changes_requested)
  const { data: decidedData, error: decidedError } = await admin
    .from('submissions')
    .select('*')
    .eq('company_id', selectedCompanyId)
    .in('status', ['approved', 'changes_requested'])
    .order('updated_at', { ascending: false })
    .limit(20);

  if (decidedError) {
    console.error('Error fetching decided submissions:', decidedError);
  }

  const inReviewSubs = inReviewData ?? [];
  const decidedSubs = decidedData ?? [];
  const allSubs = [...inReviewSubs, ...decidedSubs];

  // 3. Fetch author names from memberships
  const { data: companyMembers } = await admin
    .from('memberships')
    .select('user_id, display_name, role')
    .eq('company_id', selectedCompanyId);

  const memberMap = new Map(
    (companyMembers ?? []).map((m) => [m.user_id, m.display_name || 'Author']),
  );

  // 4. Fetch findings stats for all submissions
  const allSubIds = allSubs.map((s) => s.id);
  const submissionStatsMap = new Map<
    string,
    {
      totalFindings: number;
      acceptedCount: number;
      editedCount: number;
      rejectedCount: number;
      pendingCount: number;
    }
  >();

  if (allSubIds.length > 0) {
    // Get all versions for these submissions
    const { data: versionsData } = await admin
      .from('versions')
      .select('id, submission_id, version_no')
      .in('submission_id', allSubIds)
      .order('version_no', { ascending: false });

    // Find the latest version ID for each submission
    const latestVersionBySub = new Map<string, string>();
    for (const v of versionsData ?? []) {
      if (!latestVersionBySub.has(v.submission_id)) {
        latestVersionBySub.set(v.submission_id, v.id);
      }
    }

    const latestVersionIds = Array.from(latestVersionBySub.values());

    if (latestVersionIds.length > 0) {
      const { data: findingsData } = await admin
        .from('findings')
        .select('id, version_id, decision')
        .in('version_id', latestVersionIds);

      // Group findings by version_id
      const findingsByVersion = new Map<string, { decision: string }[]>();
      for (const f of findingsData ?? []) {
        const list = findingsByVersion.get(f.version_id) || [];
        list.push({ decision: f.decision });
        findingsByVersion.set(f.version_id, list);
      }

      // Compute stats for each submission based on its latest version
      for (const sub of allSubs) {
        const vId = latestVersionBySub.get(sub.id);
        const fList = vId ? findingsByVersion.get(vId) || [] : [];

        let accepted = 0;
        let edited = 0;
        let rejected = 0;
        let pending = 0;

        for (const item of fList) {
          if (item.decision === 'accepted') accepted++;
          else if (item.decision === 'edited') edited++;
          else if (item.decision === 'rejected') rejected++;
          else pending++;
        }

        submissionStatsMap.set(sub.id, {
          totalFindings: fList.length,
          acceptedCount: accepted,
          editedCount: edited,
          rejectedCount: rejected,
          pendingCount: pending,
        });
      }
    }
  }

  const mapToItem = (sub: any): ReviewSubmissionItem => {
    const stats = submissionStatsMap.get(sub.id) || {
      totalFindings: 0,
      acceptedCount: 0,
      editedCount: 0,
      rejectedCount: 0,
      pendingCount: 0,
    };

    return {
      id: sub.id,
      title: sub.title,
      author_id: sub.author_id,
      author_name: memberMap.get(sub.author_id) || 'Unknown Author',
      status: sub.status,
      created_at: sub.created_at,
      updated_at: sub.updated_at,
      totalFindings: stats.totalFindings,
      acceptedCount: stats.acceptedCount,
      editedCount: stats.editedCount,
      rejectedCount: stats.rejectedCount,
      pendingCount: stats.pendingCount,
    };
  };

  const companies: CompanyOption[] = reviewerMemberships.map((m) => ({
    companyId: m.companyId,
    companyName: m.displayName || m.name || m.companyId,
    role: m.role,
  }));

  return (
    <ReviewDashboardClient
      companies={companies}
      activeCompanyId={selectedCompanyId}
      inReviewSubmissions={inReviewSubs.map(mapToItem)}
      decidedSubmissions={decidedSubs.map(mapToItem)}
    />
  );
}

export default function ReviewPage(props: ReviewPageProps) {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 py-16 text-center text-sm text-muted-foreground">
          Loading review queue...
        </div>
      }
    >
      <ReviewContent {...props} />
    </Suspense>
  );
}
