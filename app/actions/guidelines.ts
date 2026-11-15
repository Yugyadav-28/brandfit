"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMember, requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import kit from "@/seed/sample-brand-kit.json";

export interface ActionResult {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  insertedRules?: number;
  insertedFacts?: number;
  insertedTerms?: number;
}

const VALID_CATEGORIES = [
  "tone",
  "terminology",
  "claims",
  "facts",
  "visual",
  "accessibility",
] as const;

const SaveRuleSchema = z.object({
  companyId: z.string().min(1, "Company ID is required."),
  id: z.string().optional(),
  code: z
    .string()
    .trim()
    .min(1, "Please enter a rule code.")
    .max(20, "Rule code must be 20 characters or fewer."),
  category: z.enum(VALID_CATEGORIES, {
    message: "Please select a category (tone, terminology, claims, facts, visual, or accessibility).",
  }),
  title: z
    .string()
    .trim()
    .min(2, "Rule title must be between 2 and 120 characters.")
    .max(120, "Rule title must be between 2 and 120 characters."),
  body: z
    .string()
    .trim()
    .min(5, "Rule instructions must be at least 5 characters.")
    .max(2000, "Rule instructions must be 2000 characters or fewer."),
});

const DeleteRuleSchema = z.object({
  companyId: z.string().min(1, "Company ID is required."),
  ruleId: z.string().min(1, "Rule ID is required."),
  code: z.string().min(1, "Rule code is required."),
});

const SaveFactSchema = z.object({
  companyId: z.string().min(1, "Company ID is required."),
  id: z.string().optional(),
  code: z
    .string()
    .trim()
    .min(1, "Please enter a fact code.")
    .max(20, "Fact code must be 20 characters or fewer."),
  statement: z
    .string()
    .trim()
    .min(5, "Fact statement must be at least 5 characters.")
    .max(2000, "Fact statement must be 2000 characters or fewer."),
  source: z.string().trim().max(200, "Source reference must be 200 characters or fewer.").optional().nullable(),
  updated_on: z.string().optional(),
});

const DeleteFactSchema = z.object({
  companyId: z.string().min(1, "Company ID is required."),
  factId: z.string().min(1, "Fact ID is required."),
  code: z.string().min(1, "Fact code is required."),
});

const SaveTermSchema = z.object({
  companyId: z.string().min(1, "Company ID is required."),
  id: z.string().optional(),
  preferred: z
    .string()
    .trim()
    .min(1, "Please enter the preferred term.")
    .max(100, "Preferred term must be 100 characters or fewer."),
  avoid: z
    .string()
    .trim()
    .min(1, "Please enter the term to avoid.")
    .max(100, "Term to avoid must be 100 characters or fewer."),
  note: z.string().trim().max(500, "Usage note must be 500 characters or fewer.").optional().nullable(),
});

const DeleteTermSchema = z.object({
  companyId: z.string().min(1, "Company ID is required."),
  termId: z.string().min(1, "Term ID is required."),
  preferred: z.string().min(1, "Preferred term is required."),
});

const LoadSampleBrandKitSchema = z.object({
  companyId: z.string().min(1, "Company ID is required."),
});

export async function saveRuleAction(
  companyId: string,
  data: {
    id?: string;
    code: string;
    category: string;
    title: string;
    body: string;
  },
): Promise<ActionResult> {
  const validated = SaveRuleSchema.safeParse({ companyId, ...data });
  if (!validated.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of validated.error.issues) {
      const field = issue.path[issue.path.length - 1] as string;
      if (!fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { error: validated.error.issues[0]?.message || "Invalid rule data.", fieldErrors };
  }

  const member = await requireMember(companyId, "employer");
  const admin = createAdminClient();

  const { code, category, title, body, id } = validated.data;

  // Check code uniqueness per company
  const { data: existing } = await admin
    .from("rules")
    .select("id")
    .eq("company_id", companyId)
    .ilike("code", code)
    .maybeSingle();

  if (existing && existing.id !== id) {
    return {
      error: `Rule code "${code}" is already taken in your company. Please choose a different code.`,
      fieldErrors: { code: `Rule code "${code}" is already taken.` },
    };
  }

  if (id) {
    // Update existing rule
    const { error } = await admin
      .from("rules")
      .update({
        code,
        category,
        title,
        body,
      })
      .eq("id", id)
      .eq("company_id", companyId);

    if (error) {
      console.error("Failed to update rule:", error);
      return { error: "Unable to update this rule right now. Please try again." };
    }
  } else {
    // Insert new rule
    const { error } = await admin.from("rules").insert({
      company_id: companyId,
      code,
      category,
      title,
      body,
    });

    if (error) {
      console.error("Failed to create rule:", error);
      return { error: "Unable to save this rule right now. Please try again." };
    }
  }

  await logAudit({
    companyId,
    userId: member.user.id,
    action: "rule_saved",
    detail: {
      code,
      category,
      title,
      body,
    },
  });

  revalidatePath("/company/guidelines");
  return { success: true };
}

export async function deleteRuleAction(
  companyId: string,
  ruleId: string,
  code: string,
): Promise<ActionResult> {
  const validated = DeleteRuleSchema.safeParse({ companyId, ruleId, code });
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || "Invalid input." };
  }

  const member = await requireMember(companyId, "employer");
  const admin = createAdminClient();

  const { error } = await admin
    .from("rules")
    .delete()
    .eq("id", ruleId)
    .eq("company_id", companyId);

  if (error) {
    console.error("Failed to delete rule:", error);
    return { error: "Unable to delete this rule right now. Please try again." };
  }

  await logAudit({
    companyId,
    userId: member.user.id,
    action: "rule_deleted",
    detail: {
      rule_id: ruleId,
      code,
    },
  });

  revalidatePath("/company/guidelines");
  return { success: true };
}

export async function saveFactAction(
  companyId: string,
  data: {
    id?: string;
    code: string;
    statement: string;
    source?: string;
    updated_on?: string;
  },
): Promise<ActionResult> {
  const validated = SaveFactSchema.safeParse({ companyId, ...data });
  if (!validated.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of validated.error.issues) {
      const field = issue.path[issue.path.length - 1] as string;
      if (!fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { error: validated.error.issues[0]?.message || "Invalid fact data.", fieldErrors };
  }

  const member = await requireMember(companyId, "employer");
  const admin = createAdminClient();

  const { code, statement, source, id } = validated.data;
  const updated_on = validated.data.updated_on || new Date().toISOString().split("T")[0];

  // Check code uniqueness per company
  const { data: existing } = await admin
    .from("facts")
    .select("id")
    .eq("company_id", companyId)
    .ilike("code", code)
    .maybeSingle();

  if (existing && existing.id !== id) {
    return {
      error: `Fact code "${code}" is already taken in your company. Please choose a different code.`,
      fieldErrors: { code: `Fact code "${code}" is already taken.` },
    };
  }

  if (id) {
    const { error } = await admin
      .from("facts")
      .update({
        code,
        statement,
        source: source || null,
        updated_on,
      })
      .eq("id", id)
      .eq("company_id", companyId);

    if (error) {
      console.error("Failed to update fact:", error);
      return { error: "Unable to update this fact right now. Please try again." };
    }
  } else {
    const { error } = await admin.from("facts").insert({
      company_id: companyId,
      code,
      statement,
      source: source || null,
      updated_on,
    });

    if (error) {
      console.error("Failed to create fact:", error);
      return { error: "Unable to save this fact right now. Please try again." };
    }
  }

  await logAudit({
    companyId,
    userId: member.user.id,
    action: "fact_saved",
    detail: {
      code,
      statement,
      source: source || null,
      updated_on,
    },
  });

  revalidatePath("/company/guidelines");
  return { success: true };
}

export async function deleteFactAction(
  companyId: string,
  factId: string,
  code: string,
): Promise<ActionResult> {
  const validated = DeleteFactSchema.safeParse({ companyId, factId, code });
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || "Invalid input." };
  }

  const member = await requireMember(companyId, "employer");
  const admin = createAdminClient();

  const { error } = await admin
    .from("facts")
    .delete()
    .eq("id", factId)
    .eq("company_id", companyId);

  if (error) {
    console.error("Failed to delete fact:", error);
    return { error: "Unable to delete this fact right now. Please try again." };
  }

  await logAudit({
    companyId,
    userId: member.user.id,
    action: "fact_saved",
    detail: {
      fact_id: factId,
      code,
      deleted: true,
    },
  });

  revalidatePath("/company/guidelines");
  return { success: true };
}

export async function saveTermAction(
  companyId: string,
  data: {
    id?: string;
    preferred: string;
    avoid: string;
    note?: string;
  },
): Promise<ActionResult> {
  const validated = SaveTermSchema.safeParse({ companyId, ...data });
  if (!validated.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of validated.error.issues) {
      const field = issue.path[issue.path.length - 1] as string;
      if (!fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { error: validated.error.issues[0]?.message || "Invalid term data.", fieldErrors };
  }

  const member = await requireMember(companyId, "employer");
  const admin = createAdminClient();

  const { preferred, avoid, note, id } = validated.data;

  if (id) {
    const { error } = await admin
      .from("terms")
      .update({
        preferred,
        avoid,
        note: note || null,
      })
      .eq("id", id)
      .eq("company_id", companyId);

    if (error) {
      console.error("Failed to update term:", error);
      return { error: "Unable to update this term right now. Please try again." };
    }
  } else {
    const { error } = await admin.from("terms").insert({
      company_id: companyId,
      preferred,
      avoid,
      note: note || null,
    });

    if (error) {
      console.error("Failed to create term:", error);
      return { error: "Unable to save this term right now. Please try again." };
    }
  }

  await logAudit({
    companyId,
    userId: member.user.id,
    action: "term_saved",
    detail: {
      preferred,
      avoid,
      note: note || null,
    },
  });

  revalidatePath("/company/guidelines");
  return { success: true };
}

export async function deleteTermAction(
  companyId: string,
  termId: string,
  preferred: string,
): Promise<ActionResult> {
  const validated = DeleteTermSchema.safeParse({ companyId, termId, preferred });
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || "Invalid input." };
  }

  const member = await requireMember(companyId, "employer");
  const admin = createAdminClient();

  const { error } = await admin
    .from("terms")
    .delete()
    .eq("id", termId)
    .eq("company_id", companyId);

  if (error) {
    console.error("Failed to delete term:", error);
    return { error: "Unable to delete this term right now. Please try again." };
  }

  await logAudit({
    companyId,
    userId: member.user.id,
    action: "term_saved",
    detail: {
      term_id: termId,
      preferred,
      deleted: true,
    },
  });

  revalidatePath("/company/guidelines");
  return { success: true };
}

export async function loadSampleBrandKitAction(
  companyId: string,
): Promise<ActionResult> {
  const validated = LoadSampleBrandKitSchema.safeParse({ companyId });
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || "Invalid company ID." };
  }

  const member = await requireMember(companyId, "employer");
  const admin = createAdminClient();

  // 1. Insert rules (skip existing codes)
  const { data: existingRules } = await admin
    .from("rules")
    .select("code")
    .eq("company_id", companyId);

  const existingRuleCodes = new Set(
    (existingRules || []).map((r) => r.code.trim().toUpperCase()),
  );

  let insertedRules = 0;
  for (const r of kit.rules || []) {
    const codeUpper = r.code.trim().toUpperCase();
    if (!existingRuleCodes.has(codeUpper)) {
      const { error } = await admin.from("rules").insert({
        company_id: companyId,
        code: r.code.trim(),
        category: r.category.trim(),
        title: r.title.trim(),
        body: r.body.trim(),
      });

      if (!error) {
        insertedRules++;
        existingRuleCodes.add(codeUpper);
        await logAudit({
          companyId,
          userId: member.user.id,
          action: "rule_saved",
          detail: {
            code: r.code.trim(),
            category: r.category.trim(),
            title: r.title.trim(),
            body: r.body.trim(),
            source: "sample_brand_kit",
          },
        });
      }
    }
  }

  // 2. Insert facts (skip existing codes)
  const { data: existingFacts } = await admin
    .from("facts")
    .select("code")
    .eq("company_id", companyId);

  const existingFactCodes = new Set(
    (existingFacts || []).map((f) => f.code.trim().toUpperCase()),
  );

  let insertedFacts = 0;
  for (const f of kit.facts || []) {
    const codeUpper = f.code.trim().toUpperCase();
    if (!existingFactCodes.has(codeUpper)) {
      const { error } = await admin.from("facts").insert({
        company_id: companyId,
        code: f.code.trim(),
        statement: f.statement.trim(),
        source: f.source?.trim() || null,
        updated_on: new Date().toISOString().split("T")[0],
      });

      if (!error) {
        insertedFacts++;
        existingFactCodes.add(codeUpper);
        await logAudit({
          companyId,
          userId: member.user.id,
          action: "fact_saved",
          detail: {
            code: f.code.trim(),
            statement: f.statement.trim(),
            source: f.source?.trim(),
            source_type: "sample_brand_kit",
          },
        });
      }
    }
  }

  // 3. Insert terms (skip existing preferred terms)
  const { data: existingTerms } = await admin
    .from("terms")
    .select("preferred")
    .eq("company_id", companyId);

  const existingTermsSet = new Set(
    (existingTerms || []).map((t) => t.preferred.trim().toLowerCase()),
  );

  let insertedTerms = 0;
  for (const t of kit.terms || []) {
    const prefLower = t.preferred.trim().toLowerCase();
    if (!existingTermsSet.has(prefLower)) {
      const { error } = await admin.from("terms").insert({
        company_id: companyId,
        preferred: t.preferred.trim(),
        avoid: t.avoid.trim(),
        note: t.note?.trim() || null,
      });

      if (!error) {
        insertedTerms++;
        existingTermsSet.add(prefLower);
        await logAudit({
          companyId,
          userId: member.user.id,
          action: "term_saved",
          detail: {
            preferred: t.preferred.trim(),
            avoid: t.avoid.trim(),
            note: t.note?.trim(),
            source: "sample_brand_kit",
          },
        });
      }
    }
  }

  revalidatePath("/company/guidelines");
  return {
    success: true,
    insertedRules,
    insertedFacts,
    insertedTerms,
  };
}
