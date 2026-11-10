import { NextRequest, NextResponse } from 'next/server';
import { requireUser, requireMember } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
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

    const { companyId, title, content } = body as {
      companyId?: string;
      title?: string;
      content?: string;
    };

    if (!companyId || typeof companyId !== 'string' || !companyId.trim()) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 },
      );
    }

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json(
        { error: 'title is required' },
        { status: 400 },
      );
    }

    if (title.trim().length > 500) {
      return NextResponse.json(
        { error: 'Title must not exceed 500 characters' },
        { status: 400 },
      );
    }

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

    const user = await requireUser();
    await requireMember(companyId);

    const admin = createAdminClient();

    // Insert submission with status 'draft' and author as the caller
    const { data: submission, error: subError } = await admin
      .from('submissions')
      .insert({
        company_id: companyId,
        author_id: user.id,
        title: title.trim(),
        status: 'draft',
      })
      .select('id')
      .single();

    if (subError || !submission) {
      console.error('Failed to create submission:', subError);
      return NextResponse.json(
        { error: 'Failed to create submission' },
        { status: 500 },
      );
    }

    // Insert initial version 1
    const { data: version, error: verError } = await admin
      .from('versions')
      .insert({
        submission_id: submission.id,
        version_no: 1,
        content,
      })
      .select('id')
      .single();

    if (verError || !version) {
      console.error('Failed to create initial version:', verError);
      await admin.from('submissions').delete().eq('id', submission.id);
      return NextResponse.json(
        { error: 'Failed to create initial version' },
        { status: 500 },
      );
    }

    // Log submission_created
    await logAudit({
      companyId,
      userId: user.id,
      action: 'submission_created',
      detail: {
        submissionId: submission.id,
        versionId: version.id,
        title: title.trim(),
      },
    });

    return NextResponse.json(
      { submissionId: submission.id, versionId: version.id },
      { status: 201 },
    );
  } catch (error: any) {
    if (error?.digest?.startsWith('NEXT_REDIRECT')) {
      throw error;
    }
    if (error?.message?.startsWith('Forbidden') || error?.name === 'ForbiddenError') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Unexpected error in POST /api/submissions:', error);
    return NextResponse.json(
      { error: 'Failed to create submission. Please try again.' },
      { status: 500 },
    );
  }
}
