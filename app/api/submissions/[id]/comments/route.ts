import { NextRequest, NextResponse } from 'next/server';
import { requireUser, requireMember } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit';

export async function GET(
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

    // 1. Fetch submission
    const { data: submission, error: subError } = await admin
      .from('submissions')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (subError || !submission) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 },
      );
    }

    // 2. Auth: member of company
    const user = await requireUser();
    const { role } = await requireMember(submission.company_id);

    const isAuthor = submission.author_id === user.id;
    const isReviewerOrEmployer = role === 'reviewer' || role === 'employer';

    if (!isAuthor && !isReviewerOrEmployer) {
      return NextResponse.json(
        { error: 'Forbidden: You cannot view comments for this submission' },
        { status: 403 },
      );
    }

    // 3. Fetch comments
    const { data: comments, error: comError } = await admin
      .from('comments')
      .select('*')
      .eq('submission_id', id)
      .order('created_at', { ascending: true });

    if (comError) {
      console.error('Error fetching comments:', comError);
      return NextResponse.json(
        { error: 'Failed to fetch comments' },
        { status: 500 },
      );
    }

    // Fetch member display names
    const { data: members } = await admin
      .from('memberships')
      .select('user_id, display_name, role')
      .eq('company_id', submission.company_id);

    const memberMap = new Map((members ?? []).map((m) => [m.user_id, m]));

    const enrichedComments = (comments ?? []).map((c) => {
      const mem = memberMap.get(c.author_id);
      return {
        ...c,
        author_display_name: mem?.display_name || 'Member',
        author_role: mem?.role || 'employee',
      };
    });

    return NextResponse.json({ comments: enrichedComments });
  } catch (err: any) {
    if (err?.status === 401 || err?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (err?.message?.includes('Forbidden')) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error('Unexpected error in GET /api/submissions/[id]/comments:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 },
    );
  }
}

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

    const { body: commentText } = body as { body?: string };

    if (!commentText || typeof commentText !== 'string' || !commentText.trim()) {
      return NextResponse.json(
        { error: 'Comment body cannot be empty' },
        { status: 400 },
      );
    }

    if (commentText.length > 5000) {
      return NextResponse.json(
        { error: 'Comment cannot exceed 5,000 characters' },
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

    // 2. Auth: any member of the company who is author, reviewer or employer
    const user = await requireUser();
    const { role } = await requireMember(submission.company_id);

    const isAuthor = submission.author_id === user.id;
    const isReviewerOrEmployer = role === 'reviewer' || role === 'employer';

    if (!isAuthor && !isReviewerOrEmployer) {
      return NextResponse.json(
        {
          error:
            'Forbidden: Only the author, a reviewer, or an employer may comment on this submission',
        },
        { status: 403 },
      );
    }

    // 3. Insert comment
    const { data: newComment, error: insertError } = await admin
      .from('comments')
      .insert({
        submission_id: id,
        author_id: user.id,
        body: commentText.trim(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting comment:', insertError);
      return NextResponse.json(
        { error: 'Failed to add comment' },
        { status: 500 },
      );
    }

    // 4. Log audit action: comment_added
    await logAudit({
      companyId: submission.company_id,
      userId: user.id,
      action: 'comment_added',
      detail: {
        submissionId: id,
        commentId: newComment?.id,
        authorId: user.id,
      },
    });

    // 5. Fetch display name for return
    const { data: membership } = await admin
      .from('memberships')
      .select('display_name, role')
      .eq('company_id', submission.company_id)
      .eq('user_id', user.id)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      comment: {
        ...newComment,
        author_display_name: membership?.display_name || 'Member',
        author_role: membership?.role || role,
      },
    });
  } catch (err: any) {
    if (err?.status === 401 || err?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (err?.message?.includes('Forbidden')) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error('Unexpected error in POST /api/submissions/[id]/comments:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
