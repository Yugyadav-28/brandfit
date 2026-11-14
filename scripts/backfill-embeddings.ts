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
  console.log('=== Starting Embeddings Backfill ===\n');

  // Dynamically import store and admin after environment and server-only stub are initialized
  const { createAdminClient } = await import('../lib/supabase/admin');
  const { refreshAllEmbeddings } = await import('../lib/retrieval/store');

  const supabase = createAdminClient();

  // Fetch all companies to run per-company embedding refresh and log audits
  const { data: companies, error } = await supabase
    .from('companies')
    .select('id, name');

  if (error) {
    console.error('Error fetching companies:', error);
  }

  let totalRules = 0;
  let totalFacts = 0;

  if (companies && companies.length > 0) {
    for (const comp of companies) {
      console.log(`Embedding missing rules & facts for company: ${comp.name} (${comp.id})...`);
      const { rulesCount, factsCount } = await refreshAllEmbeddings(comp.id);
      console.log(`  -> Embedded ${rulesCount} rules and ${factsCount} facts.`);
      totalRules += rulesCount;
      totalFacts += factsCount;
    }
  }

  // Also catch any rules or facts without a company_id or unassociated
  const remaining = await refreshAllEmbeddings();
  totalRules += remaining.rulesCount;
  totalFacts += remaining.factsCount;

  const totalRows = totalRules + totalFacts;
  console.log(`\n=== Backfill Completed ===`);
  console.log(`Total rows embedded: ${totalRows} (${totalRules} rules, ${totalFacts} facts)`);
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
