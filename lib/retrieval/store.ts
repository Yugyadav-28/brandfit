import { createAdminClient } from '../supabase/admin';
import { logAudit } from '../audit';
import { embedTexts } from './embed';

export interface RefreshResult {
  rulesCount: number;
  factsCount: number;
  total: number;
}

/**
 * Refreshes the embedding for a single rule.
 * Text embedded: code, title and body joined with a full stop.
 * Never throws: catches and console.errors any errors.
 */
export async function refreshRuleEmbedding(ruleId: string): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { data: rule, error } = await supabase
      .from('rules')
      .select('id, code, title, body')
      .eq('id', ruleId)
      .maybeSingle();

    if (error) {
      console.error(`Failed to fetch rule ${ruleId}:`, error);
      return;
    }

    if (!rule) {
      console.error(`Rule ${ruleId} not found`);
      return;
    }

    const text = [rule.code, rule.title, rule.body]
      .map((s) => (typeof s === 'string' ? s.trim() : ''))
      .filter((s) => s.length > 0)
      .join('. ');

    const [vector] = await embedTexts([text], 'document');
    if (!vector) {
      console.error(`Failed to generate embedding for rule ${ruleId}`);
      return;
    }

    const vectorStr = `[${vector.join(',')}]`;
    const { error: updateError } = await supabase
      .from('rules')
      .update({
        embedding: vectorStr,
        embedded_at: new Date().toISOString(),
      })
      .eq('id', ruleId);

    if (updateError) {
      console.error(`Failed to update embedding for rule ${ruleId}:`, updateError);
    }
  } catch (err) {
    console.error(`Error refreshing rule embedding for ${ruleId}:`, err);
  }
}

/**
 * Refreshes the embedding for a single fact.
 * Text embedded: code and statement.
 * Never throws: catches and console.errors any errors.
 */
export async function refreshFactEmbedding(factId: string): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { data: fact, error } = await supabase
      .from('facts')
      .select('id, code, statement')
      .eq('id', factId)
      .maybeSingle();

    if (error) {
      console.error(`Failed to fetch fact ${factId}:`, error);
      return;
    }

    if (!fact) {
      console.error(`Fact ${factId} not found`);
      return;
    }

    const text = [fact.code, fact.statement]
      .map((s) => (typeof s === 'string' ? s.trim() : ''))
      .filter((s) => s.length > 0)
      .join('. ');

    const [vector] = await embedTexts([text], 'document');
    if (!vector) {
      console.error(`Failed to generate embedding for fact ${factId}`);
      return;
    }

    const vectorStr = `[${vector.join(',')}]`;
    const { error: updateError } = await supabase
      .from('facts')
      .update({
        embedding: vectorStr,
        embedded_at: new Date().toISOString(),
      })
      .eq('id', factId);

    if (updateError) {
      console.error(`Failed to update embedding for fact ${factId}:`, updateError);
    }
  } catch (err) {
    console.error(`Error refreshing fact embedding for ${factId}:`, err);
  }
}

/**
 * Embeds every rule and fact whose embedding is null, in batches.
 * When companyId is provided, filters by company and logs embeddings_refreshed with logAudit.
 * Never throws: catches and console.errors any errors.
 */
export async function refreshAllEmbeddings(
  companyId?: string,
): Promise<RefreshResult> {
  const result: RefreshResult = { rulesCount: 0, factsCount: 0, total: 0 };

  try {
    const supabase = createAdminClient();
    const BATCH_SIZE = 50;

    // 1. Fetch rules whose embedding is null
    let rulesQuery = supabase
      .from('rules')
      .select('id, code, title, body')
      .is('embedding', null);

    if (companyId) {
      rulesQuery = rulesQuery.eq('company_id', companyId);
    }

    const { data: rulesData, error: rulesError } = await rulesQuery;
    if (rulesError) {
      console.error('Failed to query rules for embedding refresh:', rulesError);
    }

    const rules = rulesData ?? [];
    for (let i = 0; i < rules.length; i += BATCH_SIZE) {
      const batch = rules.slice(i, i + BATCH_SIZE);
      const texts = batch.map((r) =>
        [r.code, r.title, r.body]
          .map((s) => (typeof s === 'string' ? s.trim() : ''))
          .filter((s) => s.length > 0)
          .join('. '),
      );

      try {
        const vectors = await embedTexts(texts, 'document');
        const now = new Date().toISOString();

        for (let j = 0; j < batch.length; j++) {
          if (!vectors[j]) continue;
          const vectorStr = `[${vectors[j].join(',')}]`;
          const { error: updateErr } = await supabase
            .from('rules')
            .update({
              embedding: vectorStr,
              embedded_at: now,
            })
            .eq('id', batch[j].id);

          if (updateErr) {
            console.error(`Failed to save embedding for rule ${batch[j].id}:`, updateErr);
          } else {
            result.rulesCount++;
          }
        }
      } catch (batchErr) {
        console.error('Error embedding rule batch:', batchErr);
      }
    }

    // 2. Fetch facts whose embedding is null
    let factsQuery = supabase
      .from('facts')
      .select('id, code, statement')
      .is('embedding', null);

    if (companyId) {
      factsQuery = factsQuery.eq('company_id', companyId);
    }

    const { data: factsData, error: factsError } = await factsQuery;
    if (factsError) {
      console.error('Failed to query facts for embedding refresh:', factsError);
    }

    const facts = factsData ?? [];
    for (let i = 0; i < facts.length; i += BATCH_SIZE) {
      const batch = facts.slice(i, i + BATCH_SIZE);
      const texts = batch.map((f) =>
        [f.code, f.statement]
          .map((s) => (typeof s === 'string' ? s.trim() : ''))
          .filter((s) => s.length > 0)
          .join('. '),
      );

      try {
        const vectors = await embedTexts(texts, 'document');
        const now = new Date().toISOString();

        for (let j = 0; j < batch.length; j++) {
          if (!vectors[j]) continue;
          const vectorStr = `[${vectors[j].join(',')}]`;
          const { error: updateErr } = await supabase
            .from('facts')
            .update({
              embedding: vectorStr,
              embedded_at: now,
            })
            .eq('id', batch[j].id);

          if (updateErr) {
            console.error(`Failed to save embedding for fact ${batch[j].id}:`, updateErr);
          } else {
            result.factsCount++;
          }
        }
      } catch (batchErr) {
        console.error('Error embedding fact batch:', batchErr);
      }
    }

    // 3. Log embeddings_refreshed with logAudit when companyId is given
    if (companyId) {
      let userId = '';
      const { data: member } = await supabase
        .from('memberships')
        .select('user_id')
        .eq('company_id', companyId)
        .limit(1)
        .maybeSingle();

      if (member?.user_id) {
        userId = member.user_id;
      }

      await logAudit({
        companyId,
        userId,
        action: 'embeddings_refreshed',
        detail: {
          rulesCount: result.rulesCount,
          factsCount: result.factsCount,
          total: result.rulesCount + result.factsCount,
        },
      });
    }
  } catch (err) {
    console.error('Error in refreshAllEmbeddings:', err);
  }

  result.total = result.rulesCount + result.factsCount;
  return result;
}
