import fs from 'fs';
import path from 'path';

// 1. Polyfill WebSocket for Node < 22 (@supabase/supabase-js realtime requirement)
if (typeof (globalThis as any).WebSocket === 'undefined') {
  try {
    (globalThis as any).WebSocket = require('ws');
  } catch {
    // ignore
  }
}

// 2. Ensure 'server-only' and '@/...' resolve when running as a standalone script
const Module = require('module');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request: string, ...args: any[]) {
  if (request === 'server-only') {
    return __filename;
  }
  if (request.startsWith('@/')) {
    const relativePath = path.resolve(process.cwd(), request.slice(2));
    return originalResolve.call(this, relativePath, ...args);
  }
  return originalResolve.call(this, request, ...args);
};

// 3. Load .env.local if present
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

async function main() {
  const companyId = process.argv[2];
  if (!companyId) {
    console.error('Error: Company ID is required as the first argument.');
    console.error('Usage: ./node_modules/.bin/jiti scripts/load-large-kit.ts <company-id>');
    process.exit(1);
  }

  // Load kit from eval/large-brand-kit.json
  const kitPath = path.resolve(process.cwd(), 'eval/large-brand-kit.json');
  if (!fs.existsSync(kitPath)) {
    console.error(`Error: Large brand kit file not found at ${kitPath}`);
    process.exit(1);
  }

  const kitRaw = fs.readFileSync(kitPath, 'utf8');
  const kit = JSON.parse(kitRaw);

  const { createAdminClient } = await import('../lib/supabase/admin');
  const { refreshAllEmbeddings } = await import('../lib/retrieval/store');

  const supabase = createAdminClient();

  console.log(`=== Loading Large Brand Kit into Company: ${companyId} ===\n`);

  // Verify company exists
  const { data: company, error: compError } = await supabase
    .from('companies')
    .select('id, name')
    .eq('id', companyId)
    .maybeSingle();

  if (compError) {
    console.warn(`Warning: Could not query company (${compError.message})`);
  } else if (!company) {
    console.warn(`Notice: Company with id "${companyId}" not found in database.`);
  } else {
    console.log(`Target company found: "${company.name}" (${company.id})`);
  }

  // 1. Insert rules
  console.log(`Inserting ${kit.rules?.length || 0} rules...`);
  let rulesInserted = 0;
  for (const r of kit.rules || []) {
    const ruleRecord: Record<string, any> = {
      company_id: companyId,
      code: r.code.trim().toUpperCase(),
      category: r.category.trim(),
      title: r.title.trim(),
      body: r.body.trim(),
    };
    if (typeof r.needs_escalation === 'boolean') {
      ruleRecord.needs_escalation = r.needs_escalation;
    }

    let { error } = await supabase.from('rules').insert(ruleRecord);
    if (error && error.message && error.message.includes('needs_escalation')) {
      // In case table schema has not added needs_escalation column yet
      delete ruleRecord.needs_escalation;
      const retry = await supabase.from('rules').insert(ruleRecord);
      error = retry.error;
    }

    if (error) {
      console.error(`Failed to insert rule ${r.code}:`, error.message);
    } else {
      rulesInserted++;
    }
  }
  console.log(`Successfully inserted ${rulesInserted}/${kit.rules?.length || 0} rules.\n`);

  // 2. Insert facts
  console.log(`Inserting ${kit.facts?.length || 0} facts...`);
  let factsInserted = 0;
  for (const f of kit.facts || []) {
    const factRecord = {
      company_id: companyId,
      code: f.code.trim().toUpperCase(),
      statement: f.statement.trim(),
      source: f.source?.trim() || null,
    };

    const { error } = await supabase.from('facts').insert(factRecord);
    if (error) {
      console.error(`Failed to insert fact ${f.code}:`, error.message);
    } else {
      factsInserted++;
    }
  }
  console.log(`Successfully inserted ${factsInserted}/${kit.facts?.length || 0} facts.\n`);

  // 3. Insert terms
  console.log(`Inserting ${kit.terms?.length || 0} terms...`);
  let termsInserted = 0;
  for (const t of kit.terms || []) {
    const termRecord = {
      company_id: companyId,
      preferred: t.preferred.trim(),
      avoid: t.avoid.trim(),
      note: t.note?.trim() || null,
    };

    const { error } = await supabase.from('terms').insert(termRecord);
    if (error) {
      console.error(`Failed to insert term "${t.preferred}":`, error.message);
    } else {
      termsInserted++;
    }
  }
  console.log(`Successfully inserted ${termsInserted}/${kit.terms?.length || 0} terms.\n`);

  // 4. Refresh embeddings for the company
  console.log(`Calling refreshAllEmbeddings("${companyId}")...`);
  const refreshResult = await refreshAllEmbeddings(companyId);
  console.log(`Embedding refresh completed:`, refreshResult);
  console.log(`\n=== Kit loading and embedding complete ===`);
}

main().catch((err) => {
  console.error('Fatal error loading large brand kit:', err);
  process.exit(1);
});
