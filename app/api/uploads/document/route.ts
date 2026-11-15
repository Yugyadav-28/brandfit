import { NextRequest, NextResponse } from "next/server";
import { requireUser, requireMember } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { validateUpload } from "@/lib/media/validate";
import { extractDocument } from "@/lib/media/extractDocument";
import { docChecks } from "@/lib/media/docChecks";
import { runReview } from "@/lib/review/runReview";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "Invalid form data. Multipart form data required." },
        { status: 400 },
      );
    }

    const companyId = formData.get("companyId");
    const title = formData.get("title");
    const file = formData.get("file");

    if (!companyId || typeof companyId !== "string" || !companyId.trim()) {
      return NextResponse.json(
        { error: "companyId is required" },
        { status: 400 },
      );
    }

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json(
        { error: "title is required" },
        { status: 400 },
      );
    }

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "file is required" },
        { status: 400 },
      );
    }

    const user = await requireUser();
    await requireMember(companyId.trim());

    // Validate size and real content magic bytes
    const validation = await validateUpload(file, "document");
    if (!validation.ok) {
      const isTooLarge =
        validation.error?.includes("4 MB") ||
        validation.error?.includes("limit") ||
        file.size > 4 * 1024 * 1024;
      return NextResponse.json(
        { error: validation.error || "Invalid document file" },
        { status: isTooLarge ? 413 : 415 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = (file as File).name || "document";

    // Extract text and accessibility indicators
    const { text, truncated, warnings, accessibility } = await extractDocument(
      buffer,
      validation.mime || "application/pdf",
    );

    const admin = createAdminClient();
    const checkNotesStr = warnings.length > 0 ? warnings.join("\n") : null;

    // Create submission
    const { data: submission, error: subError } = await admin
      .from("submissions")
      .insert({
        company_id: companyId.trim(),
        author_id: user.id,
        title: title.trim(),
        status: "draft",
        source_type: "document",
        source_filename: fileName,
        check_notes: checkNotesStr,
      })
      .select("id")
      .single();

    if (subError || !submission) {
      console.error("Failed to create document submission:", subError);
      return NextResponse.json(
        { error: "Failed to create submission" },
        { status: 500 },
      );
    }

    // Create version 1 with extracted text
    const { data: version, error: verError } = await admin
      .from("versions")
      .insert({
        submission_id: submission.id,
        version_no: 1,
        content: text,
      })
      .select("id")
      .single();

    if (verError || !version) {
      console.error("Failed to create version 1:", verError);
      await admin.from("submissions").delete().eq("id", submission.id);
      return NextResponse.json(
        { error: "Failed to create initial version" },
        { status: 500 },
      );
    }

    // Run text review rules
    const { findings: textFindings, aiStatus } = await runReview(
      companyId.trim(),
      text,
    );

    // Load company rules for document accessibility checks
    const { data: rules } = await admin
      .from("rules")
      .select("code, category, title, body")
      .eq("company_id", companyId.trim());

    // Run document structural accessibility checks
    const documentFindings = docChecks(accessibility, fileName, rules || []);
    const allFindings = [...textFindings, ...documentFindings];

    // Save all findings
    if (allFindings.length > 0) {
      const records = allFindings.map((f) => ({
        version_id: version.id,
        source: f.source,
        category: f.category,
        severity: f.severity,
        quoted_text: f.quoted_text,
        explanation: f.explanation,
        rule_code: f.rule_code,
        suggestion: f.suggestion,
        confidence: f.confidence,
        decision: "pending",
      }));

      const { error: insErr } = await admin.from("findings").insert(records);
      if (insErr) {
        console.error("Error saving document findings:", insErr);
      }
    }

    // Log upload_reviewed (metadata only, never content)
    await logAudit({
      companyId: companyId.trim(),
      userId: user.id,
      action: "upload_reviewed",
      detail: {
        submissionId: submission.id,
        versionId: version.id,
        source_type: "document",
        source_filename: fileName,
        findingsCount: allFindings.length,
        truncated,
        warningsCount: warnings.length,
      },
    });

    return NextResponse.json(
      {
        submissionId: submission.id,
        truncated,
        warnings,
        aiStatus,
      },
      { status: 201 },
    );
  } catch (error: any) {
    if (error?.digest?.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    if (
      error?.name === "ForbiddenError" ||
      error?.message?.startsWith("Forbidden")
    ) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("Unexpected error in POST /api/uploads/document:", error);
    return NextResponse.json(
      { error: "Failed to process document upload. Please try again." },
      { status: 500 },
    );
  }
}
