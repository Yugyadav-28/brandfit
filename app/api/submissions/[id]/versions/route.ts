import { NextRequest, NextResponse } from 'next/server';
import { requireUser, requireMember } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

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

    const { content } = body as { content?: string };

    if (content === undefined || content === null || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'content is required' },
        { status: 400 },
      );
    }

    if (content.length > 10000) {
      return NextResponse.json(
        { error: 'Content must not exceed 10,000 characters' },
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

    // 2. Auth checks: require user and member of the submission's company
    const user = await requireUser();
    await requireMember(submission.company_id);

    // Only the author
    if (submission.author_id !== user.id) {
      return NextResponse.json(
        {
          error:
            'Forbidden: Only the author can create new versions for this submission',
        },
        { status: 403 },
      );
    }

    // 3. Find latest version number
    const { data: latestVersion, error: verQueryError } = await admin
      .from('versions')
      .select('version_no')
      .eq('submission_id', id)
      .order('version_no', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (verQueryError) {
      console.error('Error querying latest version:', verQueryError);
    }

    const nextVersionNo = (latestVersion?.version_no ?? 0) + 1;

    // 4. Create the next version
    const { data: newVersion, error: insError } = await admin
      .from('versions')
      .insert({
        submission_id: id,
        version_no: nextVersionNo,
        content,
      })
      .select('id')
      .single();

    if (insError || !newVersion) {
      console.error('Error creating new version:', insError);
      return NextResponse.json(
        { error: 'Failed to create new version' },
        { status: 500 },
      );
    }

    // 5. Set the submission status back to draft
    const { error: updateError } = await admin
      .from('submissions')
      .update({
        status: 'draft',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating submission status:', updateError);
    }

    // 6. Return the new versionId
    return NextResponse.json(
      { versionId: newVersion.id },
      { status: 201 },
    );
  } catch (error: any) {
    if (error?.digest?.startsWith('NEXT_REDIRECT')) {
      throw error;
    }
    if (error?.message?.startsWith('Forbidden') || error?.name === 'ForbiddenError') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error(
      'Unexpected error in POST /api/submissions/[id]/versions:',
      error,
    );
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 },
    );
  }
}
