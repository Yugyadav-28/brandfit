"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMember, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  refreshRuleEmbedding,
  refreshFactEmbedding,
  refreshAllEmbeddings,
} from "@/lib/retrieval/store";
import {
  saveRuleAction as baseSaveRuleAction,
  saveFactAction as baseSaveFactAction,
  loadSampleBrandKitAction as baseLoadSampleBrandKitAction,
  deleteRuleAction,
  deleteFactAction,
  saveTermAction,
  deleteTermAction,
  type ActionResult,
} from "@/app/actions/guidelines";
import { createAdminClient } from "@/lib/supabase/admin";
import kit from "@/seed/sample-brand-kit.json";

export {
  deleteRuleAction,
  deleteFactAction,
  saveTermAction,
  deleteTermAction,
  refreshRuleEmbedding,
  refreshFactEmbedding,
  refreshAllEmbeddings,
};
export type { ActionResult };

/**
 * Saves or updates a rule, then triggers embedding refresh without waiting.
 */
export async function saveRuleAction(
  companyId: string,
  data: {
    id?: string;
    code: string;
    category: string;
    title: string;
    body: string;
    needs_escalation?: boolean;
  },
): Promise<ActionResult & { ruleId?: string }> {
  const res = await baseSaveRuleAction(companyId, data);
  if (!res.error) {
    let ruleId = data.id;
    const admin = createAdminClient();
    if (!ruleId) {
      try {
        const { data: rule } = await admin
          .from("rules")
          .select("id")
          .eq("company_id", companyId)
          .ilike("code", data.code.trim())
          .maybeSingle();
        if (rule) ruleId = rule.id;
      } catch {
        // ignore errors
      }
    }
    if (ruleId) {
      if (data.needs_escalation !== undefined) {
        try {
          await admin
            .from("rules")
            .update({ needs_escalation: Boolean(data.needs_escalation) })
            .eq("id", ruleId)
            .eq("company_id", companyId);
        } catch (err) {
          console.error("Failed to update needs_escalation:", err);
        }
      }
      // Call refreshRuleEmbedding(ruleId) without waiting for it, ignore errors
      refreshRuleEmbedding(ruleId).catch(() => {});
    }
    return { ...res, ruleId };
  }
  return res;
}

/**
 * Saves or updates a fact, then triggers embedding refresh without waiting.
 */
export async function saveFactAction(
  companyId: string,
  data: {
    id?: string;
    code: string;
    statement: string;
    source?: string;
    updated_on?: string;
  },
): Promise<ActionResult & { factId?: string }> {
  const res = await baseSaveFactAction(companyId, data);
  if (!res.error) {
    let factId = data.id;
    if (!factId) {
      try {
        const admin = createAdminClient();
        const { data: fact } = await admin
          .from("facts")
          .select("id")
          .eq("company_id", companyId)
          .ilike("code", data.code.trim())
          .maybeSingle();
        if (fact) factId = fact.id;
      } catch {
        // ignore errors
      }
    }
    if (factId) {
      // Call refreshFactEmbedding(factId) without waiting for it, ignore errors
      refreshFactEmbedding(factId).catch(() => {});
    }
    return { ...res, factId };
  }
  return res;
}

/**
 * Loads sample brand kit, then triggers refreshAllEmbeddings without waiting.
 */
export async function loadSampleBrandKitAction(
  companyId: string,
): Promise<ActionResult> {
  const res = await baseLoadSampleBrandKitAction(companyId);
  if (!res.error) {
    // Check if any rule in kit has needs_escalation
    try {
      const admin = createAdminClient();
      for (const r of (kit.rules as any[]) || []) {
        if (r.needs_escalation !== undefined) {
          await admin
            .from("rules")
            .update({ needs_escalation: Boolean(r.needs_escalation) })
            .eq("company_id", companyId)
            .ilike("code", r.code.trim());
        }
      }
    } catch (err) {
      console.error("Error setting needs_escalation for sample kit:", err);
    }
    // Call refreshAllEmbeddings without waiting for it, ignore errors
    refreshAllEmbeddings(companyId).catch(() => {});
  }
  return res;
}

const SaveBrandColourSchema = z.object({
  companyId: z.string().min(1, "Company ID is required."),
  name: z
    .string()
    .trim()
    .min(1, "Please enter a colour name.")
    .max(50, "Colour name must be 50 characters or fewer."),
  hex: z
    .string()
    .trim()
    .transform((val) => (val.startsWith("#") ? val : `#${val}`).toUpperCase())
    .refine((val) => /^#[0-9A-F]{6}$/i.test(val), {
      message: "Invalid hex colour code. Format must be #RRGGBB (e.g. #3B82F6).",
    }),
});

const DeleteBrandColourSchema = z.object({
  companyId: z.string().min(1, "Company ID is required."),
  id: z.string().min(1, "Colour ID is required."),
});

/**
 * Saves a new brand colour for the company.
 */
export async function saveBrandColourAction(
  companyId: string,
  data: {
    name: string;
    hex: string;
  },
): Promise<ActionResult & { colourId?: string }> {
  try {
    const validated = SaveBrandColourSchema.safeParse({ companyId, ...data });
    if (!validated.success) {
      return { error: validated.error.issues[0]?.message || "Invalid brand colour data." };
    }

    await requireMember(companyId, "employer");
    const user = await requireUser();
    const admin = createAdminClient();

    const { name, hex } = validated.data;

    const { data: inserted, error } = await admin
      .from("brand_colours")
      .insert({
        company_id: companyId,
        name,
        hex,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to save brand colour:", error);
      return { error: error.message || "Failed to save brand colour." };
    }

    await logAudit({
      companyId,
      userId: user.id,
      action: "brand_colour_saved",
      detail: { name, hex, colourId: inserted?.id },
    });

    revalidatePath("/company/guidelines");
    return { success: true, colourId: inserted?.id };
  } catch (err: any) {
    console.error("Error in saveBrandColourAction:", err);
    return { error: err.message || "Failed to save brand colour." };
  }
}

/**
 * Deletes a brand colour for the company.
 */
export async function deleteBrandColourAction(
  companyId: string,
  id: string,
): Promise<ActionResult> {
  try {
    const validated = DeleteBrandColourSchema.safeParse({ companyId, id });
    if (!validated.success) {
      return { error: validated.error.issues[0]?.message || "Colour ID is required." };
    }

    await requireMember(companyId, "employer");
    const user = await requireUser();
    const admin = createAdminClient();

    const { data: existing } = await admin
      .from("brand_colours")
      .select("name, hex")
      .eq("id", id)
      .eq("company_id", companyId)
      .maybeSingle();

    const { error } = await admin
      .from("brand_colours")
      .delete()
      .eq("id", id)
      .eq("company_id", companyId);

    if (error) {
      console.error("Failed to delete brand colour:", error);
      return { error: error.message || "Failed to delete brand colour." };
    }

    await logAudit({
      companyId,
      userId: user.id,
      action: "brand_colour_deleted",
      detail: { colourId: id, name: existing?.name, hex: existing?.hex },
    });

    revalidatePath("/company/guidelines");
    return { success: true };
  } catch (err: any) {
    console.error("Error in deleteBrandColourAction:", err);
    return { error: err.message || "Failed to delete brand colour." };
  }
}
