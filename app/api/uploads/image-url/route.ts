import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const submissionId = request.nextUrl.searchParams.get("submissionId");

    if (!submissionId || !submissionId.trim()) {
      return NextResponse.json(
        { error: "submissionId is required" },
        { status: 400 },
      );
    }

    const user = await requireUser();

    const admin = createAdminClient();

    // Fetch submission details
    const { data: submission, error: subErr } = await admin
      .from("submissions")
      .select("id, company_id, author_id, image_path, source_type")
      .eq("id", submissionId.trim())
      .maybeSingle();

    if (subErr || !submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 },
      );
    }

    // Permission check: only people who may see this submission
    // Author of the submission OR company member with role employer, reviewer, or authorised_reviewer
    const isAuthor = submission.author_id === user.id;

    const { data: membership } = await admin
      .from("memberships")
      .select("role")
      .eq("company_id", submission.company_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json(
        { error: "Forbidden: You are not a member of this company" },
        { status: 403 },
      );
    }

    const canReview = [
      "employer",
      "reviewer",
      "authorised_reviewer",
    ].includes(membership.role);

    if (!isAuthor && !canReview) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to view this submission" },
        { status: 403 },
      );
    }

    if (!submission.image_path) {
      return NextResponse.json(
        { error: "This submission does not contain an uploaded image" },
        { status: 400 },
      );
    }

    // Create a signed URL valid for 10 minutes (600 seconds)
    const { data: signedData, error: signErr } = await admin.storage
      .from("uploads")
      .createSignedUrl(submission.image_path, 600);

    if (signErr || !signedData?.signedUrl) {
      console.error("Failed to generate signed URL:", signErr);
      return NextResponse.json(
        { error: "Failed to generate signed URL for image" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      url: signedData.signedUrl,
      signedUrl: signedData.signedUrl,
      expiresIn: 600,
    });
  } catch (error: any) {
    if (error?.digest?.startsWith("NEXT_")) {
      throw error;
    }
    if (
      error?.name === "ForbiddenError" ||
      error?.message?.startsWith("Forbidden")
    ) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("Unexpected error in GET /api/uploads/image-url:", error);
    return NextResponse.json(
      { error: "Failed to get image URL" },
      { status: 500 },
    );
  }
}
