import { NextRequest, NextResponse } from 'next/server';
import { requireUser, requireMember } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit';

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

    // 2. Auth checks: caller must be author
    const user = await requireUser();

    if (submission.author_id !== user.id) {
      return NextResponse.json(
        {
          error:
            'Forbidden: Only the author can send this submission for review',
        },
        { status: 403 },
      );
    }

    // Caller must be a member of the submission's company
    await requireMember(submission.company_id);

    // 3. The submission must have at least one version
    const { count, error: verError } = await admin
      .from('versions')
      .select('*', { count: 'exact', head: true })
      .eq('submission_id', id);

    if (verError) {
      console.error('Error checking submission versions:', verError);
      return NextResponse.json(
        { error: 'Failed to verify submission versions' },
        { status: 500 },
      );
    }

    if (!count || count === 0) {
      return NextResponse.json(
        {
          error:
            'Submission must have at least one version before sending for review',
        },
        { status: 400 },
      );
    }

    // 4. Set submission status to 'in_review'
    const now = new Date().toISOString();
    const { data: updatedSub, error: updateError } = await admin
      .from('submissions')
      .update({
        status: 'in_review',
        updated_at: now,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating submission status to in_review:', updateError);
      return NextResponse.json(
        { error: 'Failed to update submission status' },
        { status: 500 },
      );
    }

    // 5. Log audit action: sent_for_review
    await logAudit({
      companyId: submission.company_id,
      userId: user.id,
      action: 'sent_for_review',
      detail: {
        submissionId: id,
        title: submission.title,
      },
    });

    return NextResponse.json({
      success: true,
      submission: updatedSub,
      status: 'in_review',
    });
  } catch (err: any) {
    if (err?.status === 401 || err?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (err?.message?.includes('Forbidden')) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error('Unexpected error in POST /api/submissions/[id]/send:', err);
    return NextResponse.json(
      { error: 'Failed to send submission for review. Please try again.' },
      { status: 500 },
    );
  }
}
