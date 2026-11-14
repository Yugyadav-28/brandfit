/**
 * Test script for BrandFit insights computation (lib/insights/compute.ts).
 * Tests all 4 functions on a hand-checked data set (2 authors, 3 rules, 6 submissions).
 * Prints PASS or FAIL for each function.
 */

import type {
  InsightFinding,
  InsightRule,
  InsightSubmission,
  InsightMember,
} from '../lib/insights/compute';

const computePath = '../lib/insights/compute.ts';
const {
  mostBrokenRules,
  repeatMistakeStats,
  rejectionRates,
  trendByPeriod,
} = (await import(computePath)) as typeof import('../lib/insights/compute');

// ─── Test Data Set ───────────────────────────────────────────────────────────

const members: InsightMember[] = [
  { user_id: 'u-alice', display_name: 'Alice Smith', role: 'employee' },
  { user_id: 'u-bob', display_name: 'Bob Jones', role: 'employee' },
];

const rules: InsightRule[] = [
  { code: 'TONE-1', title: 'Professional Tone' },
  { code: 'CLAIM-1', title: 'Substantiate Claims' },
  { code: 'TERM-1', title: 'Approved Terminology' },
];

const submissions: InsightSubmission[] = [
  // Alice: 4 submissions
  { id: 'sub-1', author_id: 'u-alice', created_at: '2026-11-01T10:00:00Z' },
  { id: 'sub-2', author_id: 'u-alice', created_at: '2026-11-01T14:00:00Z' },
  { id: 'sub-3', author_id: 'u-alice', created_at: '2026-11-03T09:00:00Z' },
  { id: 'sub-4', author_id: 'u-alice', created_at: '2026-11-03T16:00:00Z' },
  // Bob: 2 submissions
  { id: 'sub-5', author_id: 'u-bob', created_at: '2026-11-01T11:00:00Z' },
  { id: 'sub-6', author_id: 'u-bob', created_at: '2026-11-03T12:00:00Z' },
];

const findings: InsightFinding[] = [
  // sub-1 (Alice, v1): 2 findings
  { id: 'f-1', submission_id: 'sub-1', rule_code: 'TONE-1', decision: 'accepted', version_no: 1 },
  { id: 'f-2', submission_id: 'sub-1', rule_code: 'CLAIM-1', decision: 'rejected', version_no: 1 },

  // sub-2 (Alice, v1): 1 finding
  { id: 'f-3', submission_id: 'sub-2', rule_code: 'TONE-1', decision: 'edited', version_no: 1 },
  // sub-2 (Alice, v2): 1 finding on second version (MUST be ignored in first-version calculations)
  { id: 'f-4', submission_id: 'sub-2', rule_code: 'TONE-1', decision: 'accepted', version_no: 2 },

  // sub-3 (Alice, v1): 2 findings
  { id: 'f-5', submission_id: 'sub-3', rule_code: 'TONE-1', decision: 'rejected', version_no: 1 },
  { id: 'f-6', submission_id: 'sub-3', rule_code: 'TERM-1', decision: 'accepted', version_no: 1 },

  // sub-4 (Alice, v1): 1 finding
  { id: 'f-7', submission_id: 'sub-4', rule_code: 'CLAIM-1', decision: 'rejected', version_no: 1 },

  // sub-5 (Bob, v1): 2 findings of TONE-1 in the same submission
  { id: 'f-8', submission_id: 'sub-5', rule_code: 'TONE-1', decision: 'rejected', version_no: 1 },
  { id: 'f-9', submission_id: 'sub-5', rule_code: 'TONE-1', decision: 'rejected', version_no: 1 },

  // sub-6 (Bob, v1): 1 pending finding (MUST be ignored in rejection rates)
  { id: 'f-10', submission_id: 'sub-6', rule_code: 'TERM-1', decision: 'pending', version_no: 1 },
];

// ─── Test Execution ──────────────────────────────────────────────────────────

let allPassed = true;

function runTest(name: string, fn: () => boolean) {
  try {
    const passed = fn();
    if (passed) {
      console.log(`[PASS] ${name}`);
    } else {
      console.error(`[FAIL] ${name}`);
      allPassed = false;
    }
  } catch (err) {
    console.error(`[FAIL] ${name} threw error:`, err);
    allPassed = false;
  }
}

console.log('=== Running Insights Computation Tests ===\n');

// ── 1. mostBrokenRules ──
runTest('mostBrokenRules: counts first version findings by rule code, sorted descending', () => {
  const result = mostBrokenRules(findings, rules);

  // Expect 3 rules:
  // TONE-1: findings 1, 3, 5, 8, 9 (count = 5) - ignores finding 4 (v2)
  // CLAIM-1: findings 2, 7 (count = 2)
  // TERM-1: findings 6, 10 (count = 2)
  if (result.length !== 3) return false;
  if (result[0].code !== 'TONE-1' || result[0].count !== 5 || result[0].title !== 'Professional Tone') {
    return false;
  }
  if (result[1].code !== 'CLAIM-1' || result[1].count !== 2) return false;
  if (result[2].code !== 'TERM-1' || result[2].count !== 2) return false;

  // Test with limit = 2
  const limited = mostBrokenRules(findings, rules, 2);
  if (limited.length !== 2 || limited[0].code !== 'TONE-1' || limited[1].code !== 'CLAIM-1') {
    return false;
  }

  return true;
});

// ── 2. repeatMistakeStats ──
runTest('repeatMistakeStats: calculates mistakes, repeated mistakes, repeat rate and rule codes', () => {
  const result = repeatMistakeStats(findings, submissions, members);

  // Alice:
  // First-version mistakes: 6 (f-1, f-2, f-3, f-5, f-6, f-7)
  // TONE-1 in sub-1, sub-2, sub-3 (3 subs >= 2) -> repeated
  // CLAIM-1 in sub-1, sub-4 (2 subs >= 2) -> repeated
  // TERM-1 in sub-3 only (1 sub) -> not repeated
  // Repeated mistakes count = 5 (f-1, f-2, f-3, f-5, f-7)
  // Repeat rate = 5 / 6 ~= 0.8333
  // Repeated codes = ['CLAIM-1', 'TONE-1']
  const alice = result.find((r) => r.author_id === 'u-alice');
  if (!alice) return false;
  if (alice.display_name !== 'Alice Smith') return false;
  if (alice.total_mistakes !== 6) return false;
  if (alice.repeated_mistakes !== 5) return false;
  if (Math.abs(alice.repeat_rate - 5 / 6) > 0.0001) return false;
  if (alice.repeated_rule_codes.length !== 2) return false;
  if (!alice.repeated_rule_codes.includes('TONE-1') || !alice.repeated_rule_codes.includes('CLAIM-1')) {
    return false;
  }

  // Bob:
  // First-version mistakes: 3 (f-8, f-9, f-10)
  // TONE-1 in sub-5 only (1 sub) -> not repeated
  // TERM-1 in sub-6 only (1 sub) -> not repeated
  // Repeated mistakes count = 0
  // Repeat rate = 0
  // Repeated codes = []
  const bob = result.find((r) => r.author_id === 'u-bob');
  if (!bob) return false;
  if (bob.display_name !== 'Bob Jones') return false;
  if (bob.total_mistakes !== 3) return false;
  if (bob.repeated_mistakes !== 0) return false;
  if (bob.repeat_rate !== 0) return false;
  if (bob.repeated_rule_codes.length !== 0) return false;

  return true;
});

// ── 3. rejectionRates ──
runTest('rejectionRates: calculates decided, rejected, rejection rate and possiblyUnclear flag', () => {
  const result = rejectionRates(findings, rules);

  // CLAIM-1: decided = 2 (f-2 rejected, f-7 rejected), rejected = 2, rate = 1.0, possiblyUnclear = false (decided < 5)
  // TONE-1: decided = 6 (f-1 acc, f-3 edit, f-4 acc, f-5 rej, f-8 rej, f-9 rej), rejected = 3, rate = 0.5, possiblyUnclear = true (decided >= 5 && rate >= 0.4)
  // TERM-1: decided = 1 (f-6 acc; f-10 is pending -> ignored), rejected = 0, rate = 0.0, possiblyUnclear = false
  // Sorted by rate descending: CLAIM-1 (1.0), TONE-1 (0.5), TERM-1 (0.0)
  if (result.length !== 3) return false;

  const claim = result[0];
  if (claim.code !== 'CLAIM-1' || claim.decided !== 2 || claim.rejected !== 2 || claim.rejection_rate !== 1.0) {
    return false;
  }
  if (claim.possibly_unclear !== false) return false;

  const tone = result[1];
  if (tone.code !== 'TONE-1' || tone.decided !== 6 || tone.rejected !== 3 || tone.rejection_rate !== 0.5) {
    return false;
  }
  if (tone.possibly_unclear !== true) return false;

  const term = result[2];
  if (term.code !== 'TERM-1' || term.decided !== 1 || term.rejected !== 0 || term.rejection_rate !== 0.0) {
    return false;
  }
  if (term.possibly_unclear !== false) return false;

  return true;
});

// ── 4. trendByPeriod ──
runTest('trendByPeriod: groups by day with gap filling and calculates findings per submission', () => {
  const daily = trendByPeriod(submissions, findings, 'day');

  // Days: 2026-11-01, 2026-11-02 (zero-gap), 2026-11-03
  if (daily.length !== 3) return false;

  // Day 1: 3 submissions (sub-1, sub-2, sub-5), 5 findings (f-1, f-2, f-3, f-8, f-9), rate = 5/3
  if (daily[0].period !== '2026-11-01' || daily[0].submissions !== 3 || daily[0].findings !== 5) {
    return false;
  }
  if (Math.abs(daily[0].findings_per_submission - 5 / 3) > 0.0001) return false;

  // Day 2 (gap day): 0 submissions, 0 findings, rate = 0
  if (daily[1].period !== '2026-11-02' || daily[1].submissions !== 0 || daily[1].findings !== 0) {
    return false;
  }
  if (daily[1].findings_per_submission !== 0) return false;

  // Day 3: 3 submissions (sub-3, sub-4, sub-6), 4 findings (f-5, f-6, f-7, f-10), rate = 4/3
  if (daily[2].period !== '2026-11-03' || daily[2].submissions !== 3 || daily[2].findings !== 4) {
    return false;
  }
  if (Math.abs(daily[2].findings_per_submission - 4 / 3) > 0.0001) return false;

  // Week test: 2026-11-01 is W44, 2026-11-03 is W45
  const weekly = trendByPeriod(submissions, findings, 'week');
  if (weekly.length !== 2) return false;
  if (weekly[0].period !== '2026-W44' || weekly[0].submissions !== 3 || weekly[0].findings !== 5) {
    return false;
  }
  if (weekly[1].period !== '2026-W45' || weekly[1].submissions !== 3 || weekly[1].findings !== 4) {
    return false;
  }

  return true;
});

console.log('\n----------------------------------------');
if (allPassed) {
  console.log('Overall: ALL TESTS PASSED ✅');
  process.exit(0);
} else {
  console.error('Overall: SOME TESTS FAILED ❌');
  process.exit(1);
}
