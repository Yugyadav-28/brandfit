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
  },
): Promise<ActionResult & { ruleId?: string }> {
  const res = await baseSaveRuleAction(companyId, data);
  if (!res.error) {
    let ruleId = data.id;
    if (!ruleId) {
      try {
        const admin = createAdminClient();
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
    // Call refreshAllEmbeddings without waiting for it, ignore errors
    refreshAllEmbeddings(companyId).catch(() => {});
  }
  return res;
}
