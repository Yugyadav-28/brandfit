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
        { error: 'Escalation ID is required' },
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

    if (
      decision === 'changes_requested' &&
      (!note || typeof note !== 'string' || !note.trim())
    ) {
      return NextResponse.json(
        { error: 'A note is required when requesting changes' },
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

    // 1. Fetch escalation
    const { data: escalation, error: escError } = await admin
      .from('escalations')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (escError) {
      console.error('Error fetching escalation:', escError);
      return NextResponse.json(
        { error: 'Failed to fetch escalation' },
        { status: 500 },
      );
    }

    if (!escalation) {
      return NextResponse.json(
        { error: 'Escalation not found' },
        { status: 404 },
      );
    }

    // 2. Escalation must be open
    if (escalation.status !== 'open') {
      return NextResponse.json(
        { error: 'Escalation is not open' },
        { status: 400 },
      );
    }

    // 3. Fetch submission to verify company membership
    const { data: submission, error: subError } = await admin
      .from('submissions')
      .select('*')
      .eq('id', escalation.submission_id)
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
        { error: 'Associated submission not found' },
        { status: 404 },
      );
    }

    // 4. Auth check: Only authorised_reviewer or employer
    const user = await requireUser();
    await requireMember(submission.company_id, [
      'authorised_reviewer',
      'employer',
    ] as any);

    const now = new Date().toISOString();
    const trimmedNote =
      typeof note === 'string' && note.trim().length > 0 ? note.trim() : null;

    // 5. Update the escalation (status, resolved_by, resolution_note, resolved_at)
    const { data: updatedEscalation, error: updateEscError } = await admin
      .from('escalations')
      .update({
        status: decision,
        resolved_by: user.id,
        resolution_note: trimmedNote,
        resolved_at: now,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateEscError || !updatedEscalation) {
      console.error('Error updating escalation:', updateEscError);
      return NextResponse.json(
        { error: 'Failed to update escalation' },
        { status: 500 },
      );
    }

    // 6. Set submission status to approved or changes_requested
    const { data: updatedSub, error: updateSubError } = await admin
      .from('submissions')
      .update({
        status: decision,
        updated_at: now,
      })
      .eq('id', submission.id)
      .select()
      .single();

    if (updateSubError || !updatedSub) {
      console.error('Error updating submission status:', updateSubError);
      return NextResponse.json(
        { error: 'Failed to update submission status' },
        { status: 500 },
      );
    }

    // 7. Insert a row in approvals
    const { data: approvalRow, error: approvalError } = await admin
      .from('approvals')
      .insert({
        submission_id: submission.id,
        reviewer_id: user.id,
        decision,
        note: trimmedNote,
      })
      .select()
      .single();

    if (approvalError || !approvalRow) {
      console.error('Error inserting approval row:', approvalError);
      return NextResponse.json(
        { error: 'Failed to record approval' },
        { status: 500 },
      );
    }

    // 8. Log escalation_resolved
    await logAudit({
      companyId: submission.company_id,
      userId: user.id,
      action: 'escalation_resolved',
      detail: {
        escalationId: id,
        submissionId: submission.id,
        decision,
        note: trimmedNote,
        approvalId: approvalRow.id,
      },
    });

    return NextResponse.json({
      success: true,
      escalation: updatedEscalation,
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
    console.error('Unexpected error in POST /api/escalations/[id]/resolve:', err);
    return NextResponse.json(
      { error: 'Failed to resolve escalation. Please try again.' },
      { status: 500 },
    );
  }
}
