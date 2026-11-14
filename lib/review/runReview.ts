import { ruleChecks } from './ruleChecks';
import type { RuleInput, TermInput } from './ruleChecks';
import { aiReview } from './aiReview';
import type { RuleItem, FactItem } from './aiReview';
import type { Finding } from '../types';
import { retrieveKit, type RetrievalStats } from '../retrieval/retrieve';

export interface BrandKit {
  rules?: (RuleItem & RuleInput)[];
  facts?: FactItem[];
  terms?: TermInput[];
}

export interface ReviewResult {
  findings: Finding[];
  aiStatus: 'ok' | 'unavailable';
  retrieval?: RetrievalStats;
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

  // 3. Merge: if an AI finding and a rule check finding have the same quoted_text and rule_code (case-insensitive), keep the rule check one
  const ruleCheckKeys = new Set(
    ruleFindings.map((f) => `${f.quoted_text}::${f.rule_code.trim().toUpperCase()}`),
  );

  const mergedFindings: Finding[] = ruleFindings.map((f) => ({
    ...f,
    rule_code: f.rule_code.trim().toUpperCase(),
  }));
  const seenAiKeys = new Set<string>();

  for (const aiFinding of aiFindings) {
    const upperCode = aiFinding.rule_code.trim().toUpperCase();
    const key = `${aiFinding.quoted_text}::${upperCode}`;
    if (!ruleCheckKeys.has(key) && !seenAiKeys.has(key)) {
      seenAiKeys.add(key);
      mergedFindings.push({
        ...aiFinding,
        rule_code: upperCode,
      });
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
  const { rules, facts, terms, stats } = await retrieveKit(companyId, text);

  const reviewResult = await reviewWithKit(text, {
    rules: rules as (RuleItem & RuleInput)[],
    facts: facts as FactItem[],
    terms: terms as TermInput[],
  });

  return {
    ...reviewResult,
    retrieval: stats,
  };
}
