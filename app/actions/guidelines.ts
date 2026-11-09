"use server";

import fs from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { requireMember, requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

export interface ActionResult {
  success?: boolean;
  error?: string;
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
  const member = await requireMember(companyId, "employer");
  const admin = createAdminClient();

  const code = data.code?.trim();
  const category = data.category?.trim();
  const title = data.title?.trim();
  const body = data.body?.trim();

  if (!code) return { error: "Rule code is required." };
  if (!category || !VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])) {
    return {
      error:
        "Please select a valid category (tone, terminology, claims, facts, visual, accessibility).",
    };
  }
  if (!title) return { error: "Rule title is required." };
  if (!body) return { error: "Rule body is required." };

  // Check code uniqueness per company
  const { data: existing } = await admin
    .from("rules")
    .select("id")
    .eq("company_id", companyId)
    .ilike("code", code)
    .maybeSingle();

  if (existing && existing.id !== data.id) {
    return {
      error: `Rule code "${code}" is already in use for this company. Please choose a unique code.`,
    };
  }

  if (data.id) {
    // Update existing rule
    const { error } = await admin
      .from("rules")
      .update({
        code,
        category,
        title,
        body,
      })
      .eq("id", data.id)
      .eq("company_id", companyId);

    if (error) {
      console.error("Failed to update rule:", error);
      return { error: "Failed to update rule. Please try again." };
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
      return { error: "Failed to create rule. Please try again." };
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
  const member = await requireMember(companyId, "employer");
  const admin = createAdminClient();

  const { error } = await admin
    .from("rules")
    .delete()
    .eq("id", ruleId)
    .eq("company_id", companyId);

  if (error) {
    console.error("Failed to delete rule:", error);
    return { error: "Failed to delete rule. Please try again." };
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
  const member = await requireMember(companyId, "employer");
  const admin = createAdminClient();

  const code = data.code?.trim();
  const statement = data.statement?.trim();
  const source = data.source?.trim() || null;
  const updated_on = data.updated_on || new Date().toISOString().split("T")[0];

  if (!code) return { error: "Fact code is required." };
  if (!statement) return { error: "Fact statement is required." };

  // Check code uniqueness per company
  const { data: existing } = await admin
    .from("facts")
    .select("id")
    .eq("company_id", companyId)
    .ilike("code", code)
    .maybeSingle();

  if (existing && existing.id !== data.id) {
    return {
      error: `Fact code "${code}" is already in use for this company. Please choose a unique code.`,
    };
  }

  if (data.id) {
    const { error } = await admin
      .from("facts")
      .update({
        code,
        statement,
        source,
        updated_on,
      })
      .eq("id", data.id)
      .eq("company_id", companyId);

    if (error) {
      console.error("Failed to update fact:", error);
      return { error: "Failed to update fact. Please try again." };
    }
  } else {
    const { error } = await admin.from("facts").insert({
      company_id: companyId,
      code,
      statement,
      source,
      updated_on,
    });

    if (error) {
      console.error("Failed to create fact:", error);
      return { error: "Failed to create fact. Please try again." };
    }
  }

  await logAudit({
    companyId,
    userId: member.user.id,
    action: "fact_saved",
    detail: {
      code,
      statement,
      source,
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
  const member = await requireMember(companyId, "employer");
  const admin = createAdminClient();

  const { error } = await admin
    .from("facts")
    .delete()
    .eq("id", factId)
    .eq("company_id", companyId);

  if (error) {
    console.error("Failed to delete fact:", error);
    return { error: "Failed to delete fact. Please try again." };
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
  const member = await requireMember(companyId, "employer");
  const admin = createAdminClient();

  const preferred = data.preferred?.trim();
  const avoid = data.avoid?.trim();
  const note = data.note?.trim() || null;

  if (!preferred) return { error: "Preferred term is required." };
  if (!avoid) return { error: "Avoid term is required." };

  if (data.id) {
    const { error } = await admin
      .from("terms")
      .update({
        preferred,
        avoid,
        note,
      })
      .eq("id", data.id)
      .eq("company_id", companyId);

    if (error) {
      console.error("Failed to update term:", error);
      return { error: "Failed to update term. Please try again." };
    }
  } else {
    const { error } = await admin.from("terms").insert({
      company_id: companyId,
      preferred,
      avoid,
      note,
    });

    if (error) {
      console.error("Failed to create term:", error);
      return { error: "Failed to create term. Please try again." };
    }
  }

  await logAudit({
    companyId,
    userId: member.user.id,
    action: "term_saved",
    detail: {
      preferred,
      avoid,
      note,
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
  const member = await requireMember(companyId, "employer");
  const admin = createAdminClient();

  const { error } = await admin
    .from("terms")
    .delete()
    .eq("id", termId)
    .eq("company_id", companyId);

  if (error) {
    console.error("Failed to delete term:", error);
    return { error: "Failed to delete term. Please try again." };
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
  const member = await requireMember(companyId, "employer");
  const admin = createAdminClient();

  // Look for seed/sample-brandkit.json or seed/sample-brand-kit.json
  const candidatePaths = [
    path.join(process.cwd(), "seed", "sample-brandkit.json"),
    path.join(process.cwd(), "seed", "sample-brand-kit.json"),
  ];

  let rawJson = "";
  for (const p of candidatePaths) {
    try {
      rawJson = await fs.readFile(p, "utf-8");
      if (rawJson) break;
    } catch {
      // try next path
    }
  }

  if (!rawJson) {
    return { error: "Could not find seed/sample-brandkit.json file." };
  }

  let kit: {
    company?: string;
    rules?: Array<{ code: string; category: string; title: string; body: string }>;
    facts?: Array<{ code: string; statement: string; source: string }>;
    terms?: Array<{ preferred: string; avoid: string; note: string }>;
  };

  try {
    kit = JSON.parse(rawJson);
  } catch (err) {
    console.error("JSON parse error:", err);
    return { error: "Failed to parse sample brand kit file." };
  }

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
