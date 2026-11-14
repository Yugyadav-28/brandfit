import { NextRequest, NextResponse } from 'next/server';
import { requireUser, requireMember } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit';
import { needsEscalation } from '@/lib/escalation/needsEscalation';

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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON request body' },
        { status: 400 },
      );
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Request body must be an object' },
        { status: 400 },
      );
    }

    const { decision, note } = body as {
      decision?: string;
      note?: string;
    };

    if (decision !== 'approved' && decision !== 'changes_requested') {
      return NextResponse.json(
        {
          error:
            "Invalid decision. Must be either 'approved' or 'changes_requested'",
        },
        { status: 400 },
      );
    }

    if (decision === 'changes_requested' && (!note || typeof note !== 'string' || !note.trim())) {
      return NextResponse.json(
        { error: 'A note explaining the requested changes is required' },
        { status: 400 },
      );
    }

    if (note && typeof note === 'string' && note.length > 5000) {
      return NextResponse.json(
        { error: 'Note must not exceed 5,000 characters' },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    // 1. Fetch submission
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

    // 2. Auth: reviewer or employer of the submission's company
    const user = await requireUser();
    const { role } = await requireMember(submission.company_id, [
      'reviewer',
      'authorised_reviewer',
      'employer',
    ] as any);

    // 3. Rule: A reviewer cannot approve their own submission unless they are an employer
    if (
      decision === 'approved' &&
      submission.author_id === user.id &&
      role !== 'employer'
    ) {
      return NextResponse.json(
        {
          error:
            'Forbidden: Reviewers cannot approve their own submissions unless they are an employer',
        },
        { status: 403 },
      );
    }

    // 3b. If approved and cites a sensitive rule, requires authorised sign off
    const userRole = role as string;
    if (
      decision === 'approved' &&
      userRole !== 'authorised_reviewer' &&
      userRole !== 'employer'
    ) {
      const sensitive = await needsEscalation(id);
      if (sensitive) {
        return NextResponse.json(
          {
            error:
              'This post cites a sensitive rule and needs authorised sign off. Escalate it instead.',
          },
          { status: 403 },
        );
      }
    }

    const trimmedNote = typeof note === 'string' && note.trim().length > 0 ? note.trim() : null;

    // 4. Insert into approvals table
    const { data: approvalRow, error: approvalError } = await admin
      .from('approvals')
      .insert({
        submission_id: id,
        reviewer_id: user.id,
        decision,
        note: trimmedNote,
      })
      .select()
      .single();

    if (approvalError) {
      console.error('Error inserting into approvals:', approvalError);
      return NextResponse.json(
        { error: 'Failed to record decision in approvals' },
        { status: 500 },
      );
    }

    // 5. Update submission status to approved or changes_requested
    const { data: updatedSub, error: updateError } = await admin
      .from('submissions')
      .update({
        status: decision,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating submission status:', updateError);
      return NextResponse.json(
        { error: 'Failed to update submission status' },
        { status: 500 },
      );
    }

    // 6. Log audit action: approved or changes_requested
    await logAudit({
      companyId: submission.company_id,
      userId: user.id,
      action: decision,
      detail: {
        submissionId: id,
        title: submission.title,
        note: trimmedNote,
        approvalId: approvalRow?.id,
      },
    });

    return NextResponse.json({
      success: true,
      decision,
      submission: updatedSub,
      approval: approvalRow,
    });
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_REDIRECT')) {
      throw err;
    }
    if (err?.status === 401 || err?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (err?.message?.includes('Forbidden') || err?.name === 'ForbiddenError') {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error('Unexpected error in POST /api/submissions/[id]/decision:', err);
    return NextResponse.json(
      { error: 'Failed to record decision. Please try again.' },
      { status: 500 },
    );
  }
}
