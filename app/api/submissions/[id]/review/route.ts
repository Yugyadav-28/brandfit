import { NextRequest, NextResponse } from 'next/server';
import { requireUser, requireMember } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { runReview } from '@/lib/review/runReview';
import { logAudit } from '@/lib/audit';
import { checkReviewRateLimit } from '@/lib/review/rateLimit';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { error: 'Submission ID is required' },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    // 1. Load submission
    const { data: submission, error: subError } = await admin
      .from('submissions')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (subError) {
      console.error('Error fetching submission:', subError);
      return NextResponse.json(
        { error: 'Failed to fetch submission' },
        { status: 500 },
      );
    }

    if (!submission) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 },
      );
    }

    // 2. Auth checks: caller must be member of the submission's company
    const user = await requireUser();

    // 2b. Rate limit: 10 review runs per user per 10 minutes
    const rateLimit = checkReviewRateLimit(user.id);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error:
            'You have reached the limit of 10 review scans per 10 minutes. Please wait a few moments before trying again.',
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfterSeconds || 60),
          },
        },
      );
    }

    const { role } = await requireMember(submission.company_id);

    // Only the author, a reviewer, an authorised_reviewer or an employer
    const isAuthor = submission.author_id === user.id;
    const userRole = role as string;
    const isAuthorizedRole =
      userRole === 'employer' ||
      userRole === 'reviewer' ||
      userRole === 'authorised_reviewer';

    if (!isAuthor && !isAuthorizedRole) {
      return NextResponse.json(
        {
          error:
            'Forbidden: Only the author, a reviewer, or an employer can review this submission',
        },
        { status: 403 },
      );
    }

    // 3. Load latest version
    const { data: latestVersion, error: verError } = await admin
      .from('versions')
      .select('*')
      .eq('submission_id', id)
      .order('version_no', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (verError) {
      console.error('Error fetching latest version:', verError);
      return NextResponse.json(
        { error: 'Failed to load latest version' },
        { status: 500 },
      );
    }

    if (!latestVersion) {
      return NextResponse.json(
        { error: 'No versions found for this submission' },
        { status: 404 },
      );
    }

    // 4. Call runReview(companyId, content)
    const { findings, aiStatus } = await runReview(
      submission.company_id,
      latestVersion.content,
    );

    // 5. Delete old findings for that version
    const { error: delError } = await admin
      .from('findings')
      .delete()
      .eq('version_id', latestVersion.id);

    if (delError) {
      console.error('Error deleting old findings:', delError);
    }

    // 6. Insert new findings with decision: 'pending'
    if (findings.length > 0) {
      const recordsToInsert = findings.map((f) => ({
        version_id: latestVersion.id,
        source: f.source,
        category: f.category,
        severity: f.severity,
        quoted_text: f.quoted_text,
        explanation: f.explanation,
        rule_code: f.rule_code,
        suggestion: f.suggestion,
        confidence: f.confidence,
        decision: 'pending',
      }));

      const { error: insError } = await admin
        .from('findings')
        .insert(recordsToInsert);

      if (insError) {
        console.error('Error saving findings:', insError);
        return NextResponse.json(
          { error: 'Failed to save findings' },
          { status: 500 },
        );
      }
    }

    // 7. Log review_run with the number of findings
    await logAudit({
      companyId: submission.company_id,
      userId: user.id,
      action: 'review_run',
      detail: {
        submissionId: id,
        versionId: latestVersion.id,
        count: findings.length,
      },
    });

    return NextResponse.json({ findings, aiStatus });
  } catch (error: any) {
    if (error?.digest?.startsWith('NEXT_REDIRECT')) {
      throw error;
    }
    if (error?.message?.startsWith('Forbidden') || error?.name === 'ForbiddenError') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Unexpected error in POST /api/submissions/[id]/review:', error);
    return NextResponse.json(
      { error: 'An error occurred while reviewing this submission. Please try again.' },
      { status: 500 },
    );
  }
}
