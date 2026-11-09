import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireUser, requireMember } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  SubmissionReviewClient,
  FindingItem,
  RuleItem,
  FactItem,
  TermItem,
} from './submission-review-client';
import { Button } from '@/components/ui/button';

interface ContentProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aiStatus?: string }>;
}

async function ReviewContent({ params, searchParams }: ContentProps) {
  const { id } = await params;
  const { aiStatus } = await searchParams;

  const user = await requireUser();
  const admin = createAdminClient();

  // 1. Load submission
  const { data: submission, error: subError } = await admin
    .from('submissions')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (subError || !submission) {
    notFound();
  }

  // 2. Author only check
  if (submission.author_id !== user.id) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-destructive mb-2">
          Access Restricted
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          Only the author of this submission can review and resolve findings on
          this page.
        </p>
        <Button asChild variant="outline">
          <Link href="/submit">Go to Submit</Link>
        </Button>
      </div>
    );
  }

  // 3. Verify membership in the company
  await requireMember(submission.company_id);

  // 4. Load latest version
  const { data: latestVersion, error: verError } = await admin
    .from('versions')
    .select('*')
    .eq('submission_id', id)
    .order('version_no', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (verError || !latestVersion) {
    notFound();
  }

  // 5. Load findings for latest version
  const { data: findingsData, error: findError } = await admin
    .from('findings')
    .select('*')
    .eq('version_id', latestVersion.id);

  if (findError) {
    console.error('Error fetching findings for version:', findError);
  }

  // 6. Load company rules, facts, and terms for citations
  const [rulesRes, factsRes, termsRes] = await Promise.all([
    admin.from('rules').select('*').eq('company_id', submission.company_id),
    admin.from('facts').select('*').eq('company_id', submission.company_id),
    admin.from('terms').select('*').eq('company_id', submission.company_id),
  ]);

  const rules = (rulesRes.data ?? []) as RuleItem[];
  const facts = (factsRes.data ?? []) as FactItem[];
  const terms = (termsRes.data ?? []) as TermItem[];
  const findings = (findingsData ?? []) as FindingItem[];

  return (
    <SubmissionReviewClient
      submission={{
        id: submission.id,
        title: submission.title,
        status: submission.status,
        company_id: submission.company_id,
        author_id: submission.author_id,
      }}
      latestVersion={{
        id: latestVersion.id,
        version_no: latestVersion.version_no,
        content: latestVersion.content,
      }}
      initialFindings={findings}
      rules={rules}
      facts={facts}
      terms={terms}
      initialAiStatus={aiStatus === 'unavailable' ? 'unavailable' : 'ok'}
    />
  );
}

export default function SubmissionReviewPage(props: ContentProps) {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 py-16 text-center text-sm text-muted-foreground">
          Loading submission review...
        </div>
      }
    >
      <ReviewContent {...props} />
    </Suspense>
  );
}
