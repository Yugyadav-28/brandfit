"use server";

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
