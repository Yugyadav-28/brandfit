import { ruleChecks } from './ruleChecks';
import type { RuleInput, TermInput } from './ruleChecks';
import { aiReview } from './aiReview';
import type { RuleItem, FactItem } from './aiReview';
import type { Finding } from '../types';

export interface BrandKit {
  rules?: (RuleItem & RuleInput)[];
  facts?: FactItem[];
  terms?: TermInput[];
}

export interface ReviewResult {
  findings: Finding[];
  aiStatus: 'ok' | 'unavailable';
}

const SEVERITY_ORDER: Record<Finding['severity'], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export async function reviewWithKit(
  text: string,
  { rules = [], facts = [], terms = [] }: BrandKit = {},
): Promise<ReviewResult> {
  // 1. Run ruleChecks
  const ruleFindings = ruleChecks(text, { rules, terms });

  // 2. Run aiReview
  const { findings: aiFindings, status: aiStatus } = await aiReview(text, {
    rules,
    facts,
  });

  // 3. Merge: if an AI finding and a rule check finding have the same quoted_text and rule_code, keep the rule check one
  const ruleCheckKeys = new Set(
    ruleFindings.map((f) => `${f.quoted_text}::${f.rule_code}`),
  );

  const mergedFindings: Finding[] = [...ruleFindings];
  const seenAiKeys = new Set<string>();

  for (const aiFinding of aiFindings) {
    const key = `${aiFinding.quoted_text}::${aiFinding.rule_code}`;
    if (!ruleCheckKeys.has(key) && !seenAiKeys.has(key)) {
      seenAiKeys.add(key);
      mergedFindings.push(aiFinding);
    }
  }

  // 4. Sort by severity with high first
  mergedFindings.sort((a, b) => {
    const rankA = SEVERITY_ORDER[a.severity] ?? 99;
    const rankB = SEVERITY_ORDER[b.severity] ?? 99;
    return rankA - rankB;
  });

  return {
    findings: mergedFindings,
    aiStatus,
  };
}

export async function runReview(
  companyId: string,
  text: string,
): Promise<ReviewResult> {
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();

  const [rulesRes, factsRes, termsRes] = await Promise.all([
    supabase.from('rules').select('*').eq('company_id', companyId),
    supabase.from('facts').select('*').eq('company_id', companyId),
    supabase.from('terms').select('*').eq('company_id', companyId),
  ]);

  if (rulesRes.error) {
    console.error('Failed to load rules in runReview:', rulesRes.error);
  }
  if (factsRes.error) {
    console.error('Failed to load facts in runReview:', factsRes.error);
  }
  if (termsRes.error) {
    console.error('Failed to load terms in runReview:', termsRes.error);
  }

  const rules = (rulesRes.data ?? []) as (RuleItem & RuleInput)[];
  const facts = (factsRes.data ?? []) as FactItem[];
  const terms = (termsRes.data ?? []) as TermInput[];

  return reviewWithKit(text, { rules, facts, terms });
}
