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

    const { reason } = body as { reason?: string };

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return NextResponse.json(
        { error: 'Reason for escalation is required' },
        { status: 400 },
      );
    }

    if (reason.trim().length > 5000) {
      return NextResponse.json(
        { error: 'Reason must not exceed 5,000 characters' },
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

    // 2. Auth check: Only a reviewer, an authorised_reviewer or an employer of that company
    const user = await requireUser();
    await requireMember(submission.company_id, [
      'reviewer',
      'authorised_reviewer',
      'employer',
    ] as any);

    // 3. Return 409 if already escalated
    if (submission.status === 'escalated') {
      return NextResponse.json(
        { error: 'Submission is already escalated' },
        { status: 409 },
      );
    }

    const { data: existingEscalation } = await admin
      .from('escalations')
      .select('id')
      .eq('submission_id', id)
      .eq('status', 'open')
      .maybeSingle();

    if (existingEscalation) {
      return NextResponse.json(
        { error: 'Submission is already escalated' },
        { status: 409 },
      );
    }

    // 4. Submission must be in_review
    if (submission.status !== 'in_review') {
      return NextResponse.json(
        {
          error: `Submission must be in_review to be escalated (current status: ${submission.status})`,
        },
        { status: 400 },
      );
    }

    const trimmedReason = reason.trim();
    const now = new Date().toISOString();

    // 5. Insert an open row in escalations
    const { data: escalation, error: escError } = await admin
      .from('escalations')
      .insert({
        submission_id: id,
        requested_by: user.id,
        reason: trimmedReason,
        status: 'open',
      })
      .select()
      .single();

    if (escError || !escalation) {
      console.error('Error inserting escalation:', escError);
      return NextResponse.json(
        { error: 'Failed to create escalation' },
        { status: 500 },
      );
    }

    // 6. Set submission status to escalated
    const { data: updatedSub, error: updateError } = await admin
      .from('submissions')
      .update({
        status: 'escalated',
        updated_at: now,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating submission status to escalated:', updateError);
      return NextResponse.json(
        { error: 'Failed to update submission status' },
        { status: 500 },
      );
    }

    // 7. Log escalated with the reason
    await logAudit({
      companyId: submission.company_id,
      userId: user.id,
      action: 'escalated',
      detail: {
        submissionId: id,
        escalationId: escalation.id,
        reason: trimmedReason,
      },
    });

    return NextResponse.json(
      {
        success: true,
        escalation,
        submission: updatedSub,
      },
      { status: 201 },
    );
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
    console.error('Unexpected error in POST /api/submissions/[id]/escalate:', err);
    return NextResponse.json(
      { error: 'Failed to escalate submission. Please try again.' },
      { status: 500 },
    );
  }
}
