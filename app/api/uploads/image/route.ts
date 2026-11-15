import { NextRequest, NextResponse } from "next/server";
import { requireUser, requireMember } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { validateUpload } from "@/lib/media/validate";
import { imageChecks } from "@/lib/media/imageChecks";
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
    const altText = formData.get("altText");
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

    // Validate size (max 4 MB) and magic bytes (PNG, JPEG, WebP)
    const validation = await validateUpload(file, "image");
    if (!validation.ok) {
      const isTooLarge =
        validation.error?.includes("4 MB") ||
        validation.error?.includes("limit") ||
        file.size > 4 * 1024 * 1024;
      return NextResponse.json(
        { error: validation.error || "Invalid image file" },
        { status: isTooLarge ? 413 : 415 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = (file as File).name || "image.png";
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const submissionId = crypto.randomUUID();
    const storagePath = `${companyId.trim()}/${submissionId}/${safeFileName}`;

    const admin = createAdminClient();

    // Upload to private Supabase Storage bucket 'uploads'
    const { error: uploadError } = await admin.storage
      .from("uploads")
      .upload(storagePath, buffer, {
        contentType: validation.mime || file.type || "image/png",
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload image file to storage" },
        { status: 500 },
      );
    }

    const cleanAlt = typeof altText === "string" ? altText.trim() : "";

    // Create submission
    const { data: submission, error: subError } = await admin
      .from("submissions")
      .insert({
        id: submissionId,
        company_id: companyId.trim(),
        author_id: user.id,
        title: title.trim(),
        status: "draft",
        source_type: "image",
        image_path: storagePath,
        image_alt: cleanAlt,
        source_filename: fileName,
        check_notes: null,
      })
      .select("id")
      .single();

    if (subError || !submission) {
      console.error("Failed to create image submission:", subError);
      // Clean up uploaded file
      await admin.storage.from("uploads").remove([storagePath]);
      return NextResponse.json(
        { error: "Failed to create submission" },
        { status: 500 },
      );
    }

    // Create version 1 whose content is the alt text
    const { data: version, error: verError } = await admin
      .from("versions")
      .insert({
        submission_id: submission.id,
        version_no: 1,
        content: cleanAlt,
      })
      .select("id")
      .single();

    if (verError || !version) {
      console.error("Failed to create version 1:", verError);
      await admin.from("submissions").delete().eq("id", submission.id);
      await admin.storage.from("uploads").remove([storagePath]);
      return NextResponse.json(
        { error: "Failed to create initial version" },
        { status: 500 },
      );
    }

    // Load company's brand colours & rules
    const { data: brandColours } = await admin
      .from("brand_colours")
      .select("name, hex")
      .eq("company_id", companyId.trim());

    const { data: rules } = await admin
      .from("rules")
      .select("code, category, title, body")
      .eq("company_id", companyId.trim());

    const palette = (brandColours || []).map((c) => ({
      name: c.name,
      hex: c.hex,
    }));

    // Run imageChecks (alt text, contrast, palette deviation, Gemini vision)
    const {
      findings: imgFindings,
      suggestedAlt,
      notes,
    } = await imageChecks({
      buffer,
      mime: validation.mime || file.type || "image/png",
      altText: cleanAlt,
      palette,
      rules: rules || [],
    });

    // Also run runReview on the alt text so tone and terminology rules apply
    let textFindings: any[] = [];
    let aiStatus: "ok" | "unavailable" = "ok";
    if (cleanAlt.length > 0) {
      const reviewRes = await runReview(companyId.trim(), cleanAlt);
      textFindings = reviewRes.findings;
      aiStatus = reviewRes.aiStatus;
    }

    const allFindings = [...imgFindings, ...textFindings];

    // Save all findings with decision: 'pending'
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
        console.error("Error saving image findings:", insErr);
      }
    }

    // Put notes in check_notes
    if (notes.length > 0) {
      await admin
        .from("submissions")
        .update({ check_notes: notes.join("\n") })
        .eq("id", submission.id);
    }

    // Log upload_reviewed (metadata only, never content)
    await logAudit({
      companyId: companyId.trim(),
      userId: user.id,
      action: "upload_reviewed",
      detail: {
        submissionId: submission.id,
        versionId: version.id,
        source_type: "image",
        source_filename: fileName,
        findingsCount: allFindings.length,
        notesCount: notes.length,
      },
    });

    return NextResponse.json(
      {
        submissionId: submission.id,
        notes,
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
    console.error("Unexpected error in POST /api/uploads/image:", error);
    return NextResponse.json(
      { error: "Failed to process image upload. Please try again." },
      { status: 500 },
    );
  }
}
