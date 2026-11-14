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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs() {
  const args = process.argv.slice(2);
  let companyId: string | null = null;
  let fresh = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--fresh') {
      fresh = true;
    } else if (arg === '--company' || arg === '--company-id') {
      companyId = args[i + 1] || null;
      i++;
    } else if (!arg.startsWith('--') && !companyId) {
      companyId = arg;
    }
  }

  return { companyId, fresh };
}

/**
 * Checks whether two quoted texts overlap within the post text.
 */
function checkTextOverlap(textA: string, textB: string, fullText: string): boolean {
  const a = (textA || '').trim().toLowerCase();
  const b = (textB || '').trim().toLowerCase();
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;

  const full = fullText.toLowerCase();
  const idxA = full.indexOf(a);
  const idxB = full.indexOf(b);
  if (idxA !== -1 && idxB !== -1) {
    const endA = idxA + a.length;
    const endB = idxB + b.length;
    return Math.max(idxA, idxB) < Math.min(endA, endB);
  }
  return false;
}

/**
 * Checks if an expected finding matches a found finding.
 * Same rule_code (case-insensitive) and quoted texts overlap.
 */
function findingsMatch(
  expected: { rule_code: string; quoted_text: string },
  found: { rule_code: string; quoted_text: string },
  fullText: string,
): boolean {
  const expCode = (expected.rule_code || '').trim().toUpperCase();
  const fndCode = (found.rule_code || '').trim().toUpperCase();
  if (expCode !== fndCode) {
    return false;
  }
  return checkTextOverlap(expected.quoted_text, found.quoted_text, fullText);
}

async function main() {
  const { companyId, fresh } = parseArgs();
  const modelName = process.env.GEMINI_MODEL || 'unknown-model';
  const today = new Date().toISOString().slice(0, 10);

  console.log(`=== BrandFit Evaluation Run ===`);
  console.log(`Date: ${today}`);
  console.log(`Model: ${modelName}`);
  console.log(`Fresh run (--fresh): ${fresh}`);
  console.log(`Northwind Company ID: ${companyId || '(None provided)'}\n`);

  // 1. Load brand kit and test posts
  const brandKitPath = path.resolve(process.cwd(), 'seed/sample-brand-kit.json');
  const postsPath = path.resolve(process.cwd(), 'eval/posts.json');

  if (!fs.existsSync(brandKitPath)) {
    throw new Error(`Brand kit not found at ${brandKitPath}`);
  }
  if (!fs.existsSync(postsPath)) {
    throw new Error(`Posts file not found at ${postsPath}`);
  }

  const sampleBrandKit = JSON.parse(fs.readFileSync(brandKitPath, 'utf8'));
  const posts: Array<{
    id: string;
    text: string;
    expected: Array<{ rule_code: string; quoted_text: string }>;
    note: string;
  }> = JSON.parse(fs.readFileSync(postsPath, 'utf8'));

  // Ensure cache dir exists
  const cacheDir = path.resolve(process.cwd(), 'eval/cache');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  // Import review runner
  const { reviewWithKit } = await import('../lib/review/runReview');

  console.log(`Evaluating ${posts.length} FreshBrew posts...`);

  interface PostEvaluationResult {
    id: string;
    text: string;
    expectedCount: number;
    foundCount: number;
    missedCount: number;
    extraCount: number;
    matchedCount: number;
    aiStatus: string;
    missed: Array<{ rule_code: string; quoted_text: string }>;
    extra: Array<{ rule_code: string; quoted_text: string }>;
    isClean: boolean;
    isTricky: boolean;
  }

  const postResults: PostEvaluationResult[] = [];

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const cacheFile = path.join(cacheDir, `${post.id}.json`);
    let reviewResult: { findings: any[]; aiStatus: string } | null = null;
    let fromCache = false;

    if (!fresh && fs.existsSync(cacheFile)) {
      try {
        const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        reviewResult = {
          findings: cached.findings || [],
          aiStatus: cached.aiStatus || 'ok',
        };
        fromCache = true;
      } catch {
        reviewResult = null;
      }
    }

    if (!reviewResult) {
      process.stdout.write(`[${i + 1}/${posts.length}] Running review on ${post.id}... `);
      try {
        reviewResult = await reviewWithKit(post.text, sampleBrandKit);

        // Retry once on unavailable AI result
        if (reviewResult.aiStatus === 'unavailable') {
          process.stdout.write(`AI unavailable. Retrying once after 4s... `);
          await sleep(4000);
          reviewResult = await reviewWithKit(post.text, sampleBrandKit);
        }

        fs.writeFileSync(
          cacheFile,
          JSON.stringify(
            {
              id: post.id,
              text: post.text,
              findings: reviewResult.findings,
              aiStatus: reviewResult.aiStatus,
              savedAt: new Date().toISOString(),
            },
            null,
            2,
          ),
          'utf8',
        );

        console.log(`done (status: ${reviewResult.aiStatus}, findings: ${reviewResult.findings.length})`);

        // 4 second pause between live posts
        if (i < posts.length - 1) {
          await sleep(4000);
        }
      } catch (err: any) {
        console.error(`Error reviewing post ${post.id}:`, err?.message || err);
        reviewResult = { findings: [], aiStatus: 'unavailable' };
      }
    } else {
      console.log(`[${i + 1}/${posts.length}] Loaded ${post.id} from cache (status: ${reviewResult.aiStatus}, findings: ${reviewResult.findings.length})`);
    }

    // Match found findings to expected ones
    const expectedList = [...post.expected];
    const foundList = [...(reviewResult.findings || [])];

    const matchedExpectedIndices = new Set<number>();
    const matchedFoundIndices = new Set<number>();

    for (let eIdx = 0; eIdx < expectedList.length; eIdx++) {
      const exp = expectedList[eIdx];
      for (let fIdx = 0; fIdx < foundList.length; fIdx++) {
        if (matchedFoundIndices.has(fIdx)) continue;
        const fnd = foundList[fIdx];
        if (findingsMatch(exp, fnd, post.text)) {
          matchedExpectedIndices.add(eIdx);
          matchedFoundIndices.add(fIdx);
          break;
        }
      }
    }

    const missed = expectedList.filter((_, idx) => !matchedExpectedIndices.has(idx));
    const extra = foundList.filter((_, idx) => !matchedFoundIndices.has(idx)).map((f) => ({
      rule_code: f.rule_code,
      quoted_text: f.quoted_text,
    }));

    // Posts 25-30 are the 6 tricky posts (0-indexed 24-29)
    const isTricky = i >= 24;
    const isClean = expectedList.length === 0;

    postResults.push({
      id: post.id,
      text: post.text,
      expectedCount: expectedList.length,
      foundCount: foundList.length,
      missedCount: missed.length,
      extraCount: extra.length,
      matchedCount: matchedExpectedIndices.size,
      aiStatus: reviewResult.aiStatus,
      missed,
      extra,
      isClean,
      isTricky,
    });
  }

  // 2. Compute summary numbers
  const totalPosts = postResults.length;
  const totalExpected = postResults.reduce((acc, p) => acc + p.expectedCount, 0);
  const totalCaught = postResults.reduce((acc, p) => acc + p.matchedCount, 0);
  const totalMissed = postResults.reduce((acc, p) => acc + p.missedCount, 0);
  const totalFound = postResults.reduce((acc, p) => acc + p.foundCount, 0);
  const totalExtra = postResults.reduce((acc, p) => acc + p.extraCount, 0);

  const cleanPosts = postResults.filter((p) => p.isClean);
  const cleanWithExtra = cleanPosts.filter((p) => p.extraCount > 0).length;

  const catchRate = totalExpected > 0 ? (totalCaught / totalExpected) * 100 : 100;
  const falseAlarmRate = totalFound > 0 ? (totalExtra / totalFound) * 100 : 0;
  const cleanPostFalseAlarmRate = cleanPosts.length > 0 ? (cleanWithExtra / cleanPosts.length) * 100 : 0;
  const aiUnavailableCount = postResults.filter((p) => p.aiStatus === 'unavailable').length;

  // Tricky posts metrics (last 6 posts)
  const trickyResults = postResults.filter((p) => p.isTricky);
  const trickyExpected = trickyResults.reduce((acc, p) => acc + p.expectedCount, 0);
  const trickyCaught = trickyResults.reduce((acc, p) => acc + p.matchedCount, 0);
  const trickyFound = trickyResults.reduce((acc, p) => acc + p.foundCount, 0);
  const trickyExtra = trickyResults.reduce((acc, p) => acc + p.extraCount, 0);
  const trickyClean = trickyResults.filter((p) => p.isClean);
  const trickyCleanWithExtra = trickyClean.filter((p) => p.extraCount > 0).length;

  const trickyCatchRate = trickyExpected > 0 ? (trickyCaught / trickyExpected) * 100 : 100;
  const trickyFalseAlarmRate = trickyFound > 0 ? (trickyExtra / trickyFound) * 100 : 0;
  const trickyCleanFalseAlarmRate = trickyClean.length > 0 ? (trickyCleanWithExtra / trickyClean.length) * 100 : 0;
  const trickyAiUnavailableCount = trickyResults.filter((p) => p.aiStatus === 'unavailable').length;

  // 3. Retrieval Recall on Northwind kit (posts-large.json)
  interface LargeEvalResult {
    id: string;
    expectedRule: string;
    hit: boolean;
    retrievedCount: number;
    retrievedCodes: string[];
  }

  let largeResults: LargeEvalResult[] = [];
  let retrievalRecall: number | null = null;
  let retrievalHits = 0;

  const largePostsPath = path.resolve(process.cwd(), 'eval/posts-large.json');
  if (companyId && fs.existsSync(largePostsPath)) {
    console.log(`\nEvaluating Northwind retrieval recall on 10 posts (Company ID: ${companyId})...`);
    const { retrieveKit } = await import('../lib/retrieval/retrieve');
    const largePosts: Array<{ id: string; text: string; rule_code: string }> = JSON.parse(
      fs.readFileSync(largePostsPath, 'utf8'),
    );

    for (const post of largePosts) {
      try {
        const kitResult = await retrieveKit(companyId, post.text);
        const retrievedCodes = (kitResult.rules || []).map((r: any) =>
          (r.code || '').trim().toUpperCase(),
        );
        const target = post.rule_code.trim().toUpperCase();
        const hit = retrievedCodes.includes(target);
        if (hit) retrievalHits++;

        largeResults.push({
          id: post.id,
          expectedRule: target,
          hit,
          retrievedCount: retrievedCodes.length,
          retrievedCodes,
        });
      } catch (err: any) {
        console.error(`Error in retrieveKit for ${post.id}:`, err?.message || err);
        largeResults.push({
          id: post.id,
          expectedRule: post.rule_code,
          hit: false,
          retrievedCount: 0,
          retrievedCodes: [],
        });
      }
    }

    retrievalRecall = largePosts.length > 0 ? (retrievalHits / largePosts.length) * 100 : 0;
    console.log(`Retrieval recall: ${retrievalRecall.toFixed(1)}% (${retrievalHits}/${largePosts.length})`);
  }

  // 4. Print per-post table (id, expected, found, missed, extra)
  console.log('\n=== Per-Post Evaluation Table ===');
  const tableData = postResults.map((p) => ({
    id: p.id,
    expected: p.expectedCount,
    found: p.foundCount,
    missed: p.missedCount,
    extra: p.extraCount,
  }));
  console.table(tableData);

  // Print Summary
  console.log('=== Evaluation Summary ===');
  console.log(`Total Posts:                   ${totalPosts}`);
  console.log(`Catch Rate (Recall):           ${catchRate.toFixed(1)}% (${totalCaught}/${totalExpected} caught)`);
  console.log(`False Alarm Rate:              ${falseAlarmRate.toFixed(1)}% (${totalExtra}/${totalFound} findings extra)`);
  console.log(`Clean Post False Alarm Rate:   ${cleanPostFalseAlarmRate.toFixed(1)}% (${cleanWithExtra}/${cleanPosts.length} clean posts flagged)`);
  console.log(`AI Unavailable Count:          ${aiUnavailableCount}`);
  console.log(`\n--- Tricky Posts (6 posts) ---`);
  console.log(`Catch Rate:                    ${trickyCatchRate.toFixed(1)}% (${trickyCaught}/${trickyExpected})`);
  console.log(`False Alarm Rate:              ${trickyFalseAlarmRate.toFixed(1)}% (${trickyExtra}/${trickyFound})`);
  console.log(`Clean Post False Alarm Rate:   ${trickyCleanFalseAlarmRate.toFixed(1)}% (${trickyCleanWithExtra}/${trickyClean.length})`);
  console.log(`AI Unavailable Count:          ${trickyAiUnavailableCount}`);

  if (retrievalRecall !== null) {
    console.log(`\n--- Northwind Retrieval (10 posts) ---`);
    console.log(`Retrieval Recall:              ${retrievalRecall.toFixed(1)}% (${retrievalHits}/${largeResults.length} rules retrieved)`);
  }

  // Collect failed posts
  const failedPosts = postResults
    .filter((p) => p.missedCount > 0 || (p.isClean && p.extraCount > 0) || p.extraCount > 0 || p.aiStatus === 'unavailable')
    .map((p) => {
      const reasons: string[] = [];
      if (p.missedCount > 0) {
        reasons.push(`Missed ${p.missedCount} finding(s): ${p.missed.map((m) => `${m.rule_code} ("${m.quoted_text}")`).join(', ')}`);
      }
      if (p.extraCount > 0) {
        reasons.push(`Extra ${p.extraCount} finding(s): ${p.extra.map((e) => `${e.rule_code} ("${e.quoted_text}")`).join(', ')}`);
      }
      if (p.aiStatus === 'unavailable') {
        reasons.push('AI review was unavailable');
      }
      return {
        id: p.id,
        reasons,
      };
    });

  // 5. Write eval/results-<date>.json
  const resultsJsonPath = path.resolve(process.cwd(), `eval/results-${today}.json`);
  const resultsPayload = {
    date: today,
    timestamp: new Date().toISOString(),
    model: modelName,
    summary: {
      totalPosts,
      totalExpected,
      totalCaught,
      totalMissed,
      totalFound,
      totalExtra,
      catchRate: `${catchRate.toFixed(1)}%`,
      falseAlarmRate: `${falseAlarmRate.toFixed(1)}%`,
      cleanPostFalseAlarmRate: `${cleanPostFalseAlarmRate.toFixed(1)}%`,
      aiUnavailableCount,
      tricky: {
        totalPosts: trickyResults.length,
        totalExpected: trickyExpected,
        totalCaught: trickyCaught,
        catchRate: `${trickyCatchRate.toFixed(1)}%`,
        totalExtra: trickyExtra,
        falseAlarmRate: `${trickyFalseAlarmRate.toFixed(1)}%`,
        aiUnavailableCount: trickyAiUnavailableCount,
      },
      retrieval:
        retrievalRecall !== null
          ? {
              companyId,
              totalPosts: largeResults.length,
              hits: retrievalHits,
              recall: `${retrievalRecall.toFixed(1)}%`,
            }
          : null,
    },
    failedPosts,
    posts: postResults,
    retrievalDetails: largeResults,
  };

  fs.writeFileSync(resultsJsonPath, JSON.stringify(resultsPayload, null, 2), 'utf8');
  console.log(`\nWritten results to: ${resultsJsonPath}`);

  // 6. Append Results section to docs/EVALUATION.md
  const evalMdPath = path.resolve(process.cwd(), 'docs/EVALUATION.md');
  const mdHeader = !fs.existsSync(evalMdPath) ? '# BrandFit Evaluation Reports\n\n' : '';

  const mdSection = `${mdHeader}
## Results (${today})
- **Date**: ${today}
- **Model**: \`${modelName}\`

### FreshBrew Benchmark (30 posts)
- **Catch Rate**: ${catchRate.toFixed(1)}% (${totalCaught}/${totalExpected} expected issues flagged)
- **False Alarm Rate**: ${falseAlarmRate.toFixed(1)}% (${totalExtra}/${totalFound} extra flags)
- **Clean Post False Alarm Rate**: ${cleanPostFalseAlarmRate.toFixed(1)}% (${cleanWithExtra}/${cleanPosts.length} clean posts falsely flagged)
- **AI Unavailable Results**: ${aiUnavailableCount}

### Tricky Posts (6 posts)
- **Catch Rate**: ${trickyCatchRate.toFixed(1)}% (${trickyCaught}/${trickyExpected})
- **False Alarm Rate**: ${trickyFalseAlarmRate.toFixed(1)}% (${trickyExtra}/${trickyFound})
- **Clean Post False Alarm Rate**: ${trickyCleanFalseAlarmRate.toFixed(1)}% (${trickyCleanWithExtra}/${trickyClean.length})
- **AI Unavailable Results**: ${trickyAiUnavailableCount}

### Northwind Retrieval Recall (10 posts)
${
  retrievalRecall !== null
    ? `- **Retrieval Recall**: ${retrievalRecall.toFixed(1)}% (${retrievalHits}/${largeResults.length} target rules successfully retrieved)
- **Target Company ID**: \`${companyId}\``
    : '- *Retrieval recall skipped (provide company ID via `./node_modules/.bin/jiti scripts/eval.ts <company-id>`)*'
}

### Failed Posts
${
  failedPosts.length === 0
    ? '- *None. All posts fully matched expected findings.*'
    : failedPosts
        .map((f) => `- **\`${f.id}\`**: ${f.reasons.join('; ')}`)
        .join('\n')
}

---
`;

  fs.appendFileSync(evalMdPath, mdSection, 'utf8');
  console.log(`Appended results section to: ${evalMdPath}`);
}

main().catch((err) => {
  console.error('Fatal error during evaluation run:', err);
  process.exit(1);
});
