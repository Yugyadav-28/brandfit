import { NextRequest, NextResponse } from 'next/server';
import { requireUser, requireMember } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { error: 'Finding ID is required' },
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

    const { decision, note, editedText } = body as {
      decision?: string;
      note?: string;
      editedText?: string;
    };

    if (
      !decision ||
      !['accepted', 'edited', 'rejected'].includes(decision)
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid decision. Must be 'accepted', 'edited', or 'rejected'",
        },
        { status: 400 },
      );
    }

    // A rejection requires a note
    if (decision === 'rejected' && (!note || !note.trim())) {
      return NextResponse.json(
        { error: 'A note is required when rejecting a finding' },
        { status: 400 },
      );
    }

    if (
      editedText !== undefined &&
      typeof editedText === 'string' &&
      editedText.length > 10000
    ) {
      return NextResponse.json(
        { error: 'Edited text must not exceed 10,000 characters' },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    // 1. Load finding
    const { data: finding, error: findError } = await admin
      .from('findings')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (findError) {
      console.error('Error fetching finding:', findError);
      return NextResponse.json(
        { error: 'Failed to fetch finding' },
        { status: 500 },
      );
    }

    if (!finding) {
      return NextResponse.json(
        { error: 'Finding not found' },
        { status: 404 },
      );
    }

    // 2. Load associated version to get submission_id
    const { data: version, error: verError } = await admin
      .from('versions')
      .select('submission_id')
      .eq('id', finding.version_id)
      .maybeSingle();

    if (verError || !version) {
      return NextResponse.json(
        { error: 'Associated version not found' },
        { status: 404 },
      );
    }

    // 3. Load submission to get company_id and author_id
    const { data: submission, error: subError } = await admin
      .from('submissions')
      .select('company_id, author_id')
      .eq('id', version.submission_id)
      .maybeSingle();

    if (subError || !submission) {
      return NextResponse.json(
        { error: 'Associated submission not found' },
        { status: 404 },
      );
    }

    // 4. Require user and member for submission's company
    const user = await requireUser();
    await requireMember(submission.company_id);

    // Only the submission author
    if (submission.author_id !== user.id) {
      return NextResponse.json(
        {
          error:
            'Forbidden: Only the submission author can decide on this finding',
        },
        { status: 403 },
      );
    }

    // 5. Update finding
    const updatePayload: Record<string, unknown> = {
      decision,
      decision_note: note?.trim() || null,
    };
    if (editedText !== undefined) {
      updatePayload.edited_text = editedText;
    }

    const { data: updatedFinding, error: updateError } = await admin
      .from('findings')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (updateError || !updatedFinding) {
      console.error('Error updating finding:', updateError);
      return NextResponse.json(
        { error: 'Failed to update finding' },
        { status: 500 },
      );
    }

    // 6. Log finding_decided
    await logAudit({
      companyId: submission.company_id,
      userId: user.id,
      action: 'finding_decided',
      detail: {
        findingId: id,
        decision,
        note: note?.trim() || null,
      },
    });

    return NextResponse.json(updatedFinding);
  } catch (error: any) {
    if (error?.digest?.startsWith('NEXT_REDIRECT')) {
      throw error;
    }
    if (error?.message?.startsWith('Forbidden') || error?.name === 'ForbiddenError') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Unexpected error in PATCH /api/findings/[id]:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 },
    );
  }
}
