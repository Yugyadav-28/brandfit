import { createAdminClient } from '../supabase/admin';
import { embedTexts } from './embed';

export interface RetrievalStats {
  mode: 'all' | 'retrieved' | 'fallback';
  totalRules: number;
  totalFacts: number;
  usedRules: number;
  usedFacts: number;
}

export interface RetrievedKit {
  rules: any[];
  facts: any[];
  terms: any[];
  stats: RetrievalStats;
}

/**
 * Splits text into chunks:
 * - Paragraphs (split by blank lines)
 * - Sentences when a paragraph is over 500 characters
 * - At most 20 chunks
 */
export function splitIntoChunks(text: string): string[] {
  if (!text || !text.trim()) {
    return [];
  }

  // Split into paragraphs (by blank lines)
  const paragraphs = text
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const chunks: string[] = [];

  for (const para of paragraphs) {
    if (para.length <= 500) {
      chunks.push(para);
    } else {
      // Split paragraph into sentences when > 500 characters
      const sentences = para
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      if (sentences.length <= 1) {
        // Fallback: slice by 500 chars if no sentence boundaries exist
        for (let i = 0; i < para.length; i += 500) {
          const slice = para.slice(i, i + 500).trim();
          if (slice.length > 0) {
            chunks.push(slice);
          }
        }
      } else {
        chunks.push(...sentences);
      }
    }
  }

  return chunks.slice(0, 20);
}

/**
 * Retrieves the relevant brand kit (rules, facts, terms) for a given company and text.
 * - If rules + facts <= 25, returns everything with mode 'all'.
 * - Otherwise embeds chunks, matches top rules and facts via RPC, deduplicates by code,
 *   and adds up to 8 tone rules with mode 'retrieved'.
 * - If embedding or database RPC fails, falls back to first 60 rules and all facts with mode 'fallback'.
 * - Always returns every terms row for the company.
 */
export async function retrieveKit(
  companyId: string,
  text: string,
): Promise<RetrievedKit> {
  const supabase = createAdminClient();
  let totalRules = 0;
  let totalFacts = 0;

  try {
    // 1. Always load every terms row for the company (Requirement 3)
    // 2. Load the company's rule and fact counts (Requirement 2)
    const [rulesCountRes, factsCountRes, termsRes] = await Promise.all([
      supabase
        .from('rules')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId),
      supabase
        .from('facts')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId),
      supabase
        .from('terms')
        .select('*')
        .eq('company_id', companyId),
    ]);

    if (rulesCountRes.error) throw new Error(rulesCountRes.error.message);
    if (factsCountRes.error) throw new Error(factsCountRes.error.message);
    if (termsRes.error) throw new Error(termsRes.error.message);

    totalRules = rulesCountRes.count ?? 0;
    totalFacts = factsCountRes.count ?? 0;
    const terms = termsRes.data ?? [];

    // If rules plus facts is 25 or fewer, return everything with mode all
    if (totalRules + totalFacts <= 25) {
      const [rulesRes, factsRes] = await Promise.all([
        supabase.from('rules').select('*').eq('company_id', companyId),
        supabase.from('facts').select('*').eq('company_id', companyId),
      ]);

      if (rulesRes.error) throw new Error(rulesRes.error.message);
      if (factsRes.error) throw new Error(factsRes.error.message);

      const rules = (rulesRes.data ?? []).map((r) => ({
        ...r,
        code: (r.code || '').trim().toUpperCase(),
      }));
      const facts = (factsRes.data ?? []).map((f) => ({
        ...f,
        code: (f.code || '').trim().toUpperCase(),
      }));

      return {
        rules,
        facts,
        terms,
        stats: {
          mode: 'all',
          totalRules: rules.length,
          totalFacts: facts.length,
          usedRules: rules.length,
          usedFacts: facts.length,
        },
      };
    }

    // Otherwise: split the text into chunks (at most 20 chunks)
    const chunks = splitIntoChunks(text);

    const matchedRules: any[] = [];
    const matchedFacts: any[] = [];
    const seenRuleCodes = new Set<string>();
    const seenFactCodes = new Set<string>();

    if (chunks.length > 0) {
      // Embed all chunks with embedTexts(chunks, 'query') in one call
      const vectors = await embedTexts(chunks, 'query');

      // Call database functions match_rules (6 per chunk) and match_facts (3 per chunk)
      const rpcPromises = vectors.map(async (vector) => {
        const vectorStr = `[${vector.join(',')}]`;
        const [rulesRes, factsRes] = await Promise.all([
          supabase.rpc('match_rules', {
            p_company: companyId,
            p_embedding: vectorStr,
            p_count: 6,
          }),
          supabase.rpc('match_facts', {
            p_company: companyId,
            p_embedding: vectorStr,
            p_count: 3,
          }),
        ]);

        if (rulesRes.error) throw new Error(rulesRes.error.message);
        if (factsRes.error) throw new Error(factsRes.error.message);

        return {
          rules: rulesRes.data ?? [],
          facts: factsRes.data ?? [],
        };
      });

      const chunkResults = await Promise.all(rpcPromises);

      // Merge and remove duplicates by code
      for (const res of chunkResults) {
        for (const r of res.rules) {
          const code = (r.code || '').trim().toUpperCase();
          if (code && !seenRuleCodes.has(code)) {
            seenRuleCodes.add(code);
            matchedRules.push({
              ...r,
              code,
            });
          }
        }
      }

      for (const res of chunkResults) {
        for (const f of res.facts) {
          const code = (f.code || '').trim().toUpperCase();
          if (code && !seenFactCodes.has(code)) {
            seenFactCodes.add(code);
            matchedFacts.push({
              ...f,
              code,
            });
          }
        }
      }
    }

    // Always add up to 8 rules of category tone
    const { data: toneRules, error: toneError } = await supabase
      .from('rules')
      .select('*')
      .eq('company_id', companyId)
      .ilike('category', 'tone')
      .limit(8);

    if (toneError) throw new Error(toneError.message);

    for (const rule of toneRules ?? []) {
      const code = (rule.code || '').trim().toUpperCase();
      if (code && !seenRuleCodes.has(code)) {
        seenRuleCodes.add(code);
        matchedRules.push({
          ...rule,
          code,
        });
      }
    }

    return {
      rules: matchedRules,
      facts: matchedFacts,
      terms,
      stats: {
        mode: 'retrieved',
        totalRules,
        totalFacts,
        usedRules: matchedRules.length,
        usedFacts: matchedFacts.length,
      },
    };
  } catch (err: any) {
    // 4. If embedding or database call fails, return first 60 rules and all facts with mode fallback
    // and console.error the reason (never the content)
    const reason = err?.message || String(err);
    console.error('retrieveKit failed, falling back to first 60 rules and all facts:', reason);

    try {
      const [fallbackRulesRes, fallbackFactsRes, termsRes] = await Promise.all([
        supabase
          .from('rules')
          .select('*')
          .eq('company_id', companyId)
          .limit(60),
        supabase
          .from('facts')
          .select('*')
          .eq('company_id', companyId),
        supabase
          .from('terms')
          .select('*')
          .eq('company_id', companyId),
      ]);

      if (fallbackRulesRes.error) {
        console.error('Failed to load fallback rules:', fallbackRulesRes.error.message);
      }
      if (fallbackFactsRes.error) {
        console.error('Failed to load fallback facts:', fallbackFactsRes.error.message);
      }
      if (termsRes.error) {
        console.error('Failed to load terms in fallback:', termsRes.error.message);
      }

      const fallbackRules = (fallbackRulesRes.data ?? []).map((r) => ({
        ...r,
        code: (r.code || '').trim().toUpperCase(),
      }));
      const fallbackFacts = (fallbackFactsRes.data ?? []).map((f) => ({
        ...f,
        code: (f.code || '').trim().toUpperCase(),
      }));
      const terms = termsRes.data ?? [];

      return {
        rules: fallbackRules,
        facts: fallbackFacts,
        terms,
        stats: {
          mode: 'fallback',
          totalRules: totalRules > 0 ? totalRules : fallbackRules.length,
          totalFacts: totalFacts > 0 ? totalFacts : fallbackFacts.length,
          usedRules: fallbackRules.length,
          usedFacts: fallbackFacts.length,
        },
      };
    } catch (fallbackErr: any) {
      console.error('Fallback retrieval query failed:', fallbackErr?.message || fallbackErr);
      return {
        rules: [],
        facts: [],
        terms: [],
        stats: {
          mode: 'fallback',
          totalRules: totalRules || 0,
          totalFacts: totalFacts || 0,
          usedRules: 0,
          usedFacts: 0,
        },
      };
    }
  }
}
