/**
 * Pure functions for BrandFit insights and analytics.
 * Operating exclusively on in-memory plain arrays without any database calls.
 */

import type { Finding as BaseFinding } from '../types';

// ─── Input Types ─────────────────────────────────────────────────────────────

export type InsightFinding = Partial<BaseFinding> & {
  id?: string;
  submission_id?: string;
  submissionId?: string;
  author_id?: string;
  authorId?: string;
  rule_code: string;
  ruleCode?: string;
  decision?: 'accepted' | 'edited' | 'rejected' | 'pending' | string | null;
  version_no?: number;
  versionNo?: number;
  is_first_version?: boolean;
  isFirstVersion?: boolean;
  created_at?: string;
  createdAt?: string;
};

export interface InsightRule {
  id?: string;
  code: string;
  title: string;
  body?: string;
  category?: string;
}

export interface InsightSubmission {
  id: string;
  author_id: string;
  authorId?: string;
  title?: string;
  created_at?: string;
  createdAt?: string;
  status?: string;
}

export interface InsightMember {
  user_id?: string;
  userId?: string;
  id?: string;
  display_name?: string | null;
  displayName?: string | null;
  role?: string;
  email?: string | null;
}

// ─── Output Types ────────────────────────────────────────────────────────────

export interface BrokenRule {
  code: string;
  title: string;
  count: number;
}

export interface RepeatMistakeStat {
  author_id: string;
  authorId: string;
  display_name: string;
  displayName: string;
  total_mistakes: number;
  totalMistakes: number;
  repeated_mistakes: number;
  repeatedMistakes: number;
  repeat_rate: number;
  repeatRate: number;
  repeated_rule_codes: string[];
  repeatedRuleCodes: string[];
}

export interface RuleRejectionRate {
  code: string;
  title: string;
  decided: number;
  rejected: number;
  rejection_rate: number;
  rejectionRate: number;
  possibly_unclear: boolean;
  possiblyUnclear: boolean;
}

export interface PeriodTrend {
  period: string;
  submissions: number;
  findings: number;
  findings_per_submission: number;
  findingsPerSubmission: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function isFirstVersionFinding(f: InsightFinding): boolean {
  if (typeof f.version_no === 'number') {
    return f.version_no === 1;
  }
  if (typeof f.versionNo === 'number') {
    return f.versionNo === 1;
  }
  if (typeof f.is_first_version === 'boolean') {
    return f.is_first_version;
  }
  if (typeof f.isFirstVersion === 'boolean') {
    return f.isFirstVersion;
  }
  return true;
}

function getISODayKey(d: Date): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getISOWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayOfWeek = date.getUTCDay() || 7; // 1 (Mon) to 7 (Sun)
  date.setUTCDate(date.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const year = date.getUTCFullYear();
  const weekStr = weekNo < 10 ? `0${weekNo}` : `${weekNo}`;
  return `${year}-W${weekStr}`;
}

// ─── 1. Most Broken Rules ────────────────────────────────────────────────────

/**
 * Counts findings in the FIRST version of each submission by rule_code,
 * and returns the top ones with code, title, and count.
 */
export function mostBrokenRules(
  findings: InsightFinding[],
  rules: InsightRule[],
  limit?: number,
): BrokenRule[] {
  const ruleMap = new Map<string, InsightRule>();
  for (const r of rules) {
    if (r.code) {
      ruleMap.set(r.code.trim().toUpperCase(), r);
    }
  }

  const counts = new Map<string, { code: string; title: string; count: number }>();

  for (const f of findings) {
    if (!isFirstVersionFinding(f)) continue;

    const rawCode = f.rule_code || f.ruleCode || '';
    const trimmed = rawCode.trim();
    if (!trimmed) continue;
    const key = trimmed.toUpperCase();

    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      const rule = ruleMap.get(key);
      const title = rule?.title || trimmed;
      const canonicalCode = rule?.code || trimmed;
      counts.set(key, { code: canonicalCode, title, count: 1 });
    }
  }

  const results = Array.from(counts.values()).sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    return a.code.localeCompare(b.code);
  });

  if (typeof limit === 'number' && limit >= 0) {
    return results.slice(0, limit);
  }
  return results;
}

// ─── 2. Repeat Mistake Stats ─────────────────────────────────────────────────

/**
 * Per author returns:
 * - total mistakes (first version findings)
 * - repeated mistakes (findings whose rule code appears in the first versions of 2+ different submissions by that author)
 * - repeat rate (repeated / total, 0 when total is 0)
 * - list of repeated rule codes
 */
export function repeatMistakeStats(
  findings: InsightFinding[],
  submissions: InsightSubmission[],
  members: InsightMember[] = [],
): RepeatMistakeStat[] {
  const memberMap = new Map<string, InsightMember>();
  for (const m of members) {
    const id = m.user_id || m.userId || m.id;
    if (id) {
      memberMap.set(id, m);
    }
  }

  const subMap = new Map<string, InsightSubmission>();
  for (const s of submissions) {
    subMap.set(s.id, s);
  }

  const authorIds = new Set<string>();
  for (const s of submissions) {
    const aId = s.author_id || s.authorId;
    if (aId) authorIds.add(aId);
  }
  for (const m of members) {
    const mId = m.user_id || m.userId || m.id;
    if (mId) authorIds.add(mId);
  }

  const authorFindingsMap = new Map<string, InsightFinding[]>();
  for (const f of findings) {
    if (!isFirstVersionFinding(f)) continue;

    let aId = f.author_id || f.authorId;
    if (!aId) {
      const subId = f.submission_id || f.submissionId;
      if (subId) {
        const sub = subMap.get(subId);
        if (sub) {
          aId = sub.author_id || sub.authorId;
        }
      }
    }

    if (aId) {
      const list = authorFindingsMap.get(aId) ?? [];
      list.push(f);
      authorFindingsMap.set(aId, list);
      authorIds.add(aId);
    }
  }

  const results: RepeatMistakeStat[] = [];

  for (const authorId of authorIds) {
    const member = memberMap.get(authorId);
    const displayName =
      member?.display_name ||
      member?.displayName ||
      member?.email ||
      `Author ${authorId.slice(0, 6)}`;

    const authorFindings = authorFindingsMap.get(authorId) ?? [];
    const totalMistakes = authorFindings.length;

    const codeToSubmissions = new Map<string, Set<string>>();
    for (const f of authorFindings) {
      const rawCode = f.rule_code || f.ruleCode || '';
      const code = rawCode.trim();
      if (!code) continue;
      const subId = f.submission_id || f.submissionId || 'default-sub';
      const set = codeToSubmissions.get(code) ?? new Set<string>();
      set.add(subId);
      codeToSubmissions.set(code, set);
    }

    const repeatedCodes: string[] = [];
    for (const [code, subs] of codeToSubmissions.entries()) {
      if (subs.size >= 2) {
        repeatedCodes.push(code);
      }
    }
    repeatedCodes.sort();

    const repeatedCodesSet = new Set(repeatedCodes);
    const repeatedMistakes = authorFindings.filter((f) => {
      const code = (f.rule_code || f.ruleCode || '').trim();
      return repeatedCodesSet.has(code);
    }).length;

    const repeatRate = totalMistakes > 0 ? repeatedMistakes / totalMistakes : 0;

    results.push({
      author_id: authorId,
      authorId,
      display_name: displayName,
      displayName,
      total_mistakes: totalMistakes,
      totalMistakes,
      repeated_mistakes: repeatedMistakes,
      repeatedMistakes,
      repeat_rate: repeatRate,
      repeatRate,
      repeated_rule_codes: repeatedCodes,
      repeatedRuleCodes: repeatedCodes,
    });
  }

  results.sort((a, b) => {
    if (b.total_mistakes !== a.total_mistakes) {
      return b.total_mistakes - a.total_mistakes;
    }
    return a.author_id.localeCompare(b.author_id);
  });

  return results;
}

// ─── 3. Rejection Rates ──────────────────────────────────────────────────────

/**
 * Per rule code:
 * - decided findings (accepted, edited, rejected; ignore pending)
 * - rejected count
 * - rejection rate (rejected / decided)
 * - possiblyUnclear = decided >= 5 && rejection_rate >= 0.4
 * Sorts by rejection rate highest first.
 */
export function rejectionRates(
  findings: InsightFinding[],
  rules: InsightRule[] = [],
): RuleRejectionRate[] {
  const ruleMap = new Map<string, InsightRule>();
  for (const r of rules) {
    if (r.code) {
      ruleMap.set(r.code.trim().toUpperCase(), r);
    }
  }

  const statsByCode = new Map<
    string,
    { code: string; title: string; decided: number; rejected: number }
  >();

  for (const r of rules) {
    const code = r.code.trim();
    if (!code) continue;
    statsByCode.set(code.toUpperCase(), {
      code,
      title: r.title || code,
      decided: 0,
      rejected: 0,
    });
  }

  for (const f of findings) {
    const decision = f.decision?.trim().toLowerCase();
    if (!decision || decision === 'pending') {
      continue;
    }
    if (decision !== 'accepted' && decision !== 'edited' && decision !== 'rejected') {
      continue;
    }

    const rawCode = f.rule_code || f.ruleCode || '';
    const code = rawCode.trim();
    if (!code) continue;
    const key = code.toUpperCase();

    let entry = statsByCode.get(key);
    if (!entry) {
      const rule = ruleMap.get(key);
      entry = {
        code: rule?.code || code,
        title: rule?.title || code,
        decided: 0,
        rejected: 0,
      };
      statsByCode.set(key, entry);
    }

    entry.decided += 1;
    if (decision === 'rejected') {
      entry.rejected += 1;
    }
  }

  const results: RuleRejectionRate[] = [];

  for (const entry of statsByCode.values()) {
    const rejectionRate = entry.decided > 0 ? entry.rejected / entry.decided : 0;
    const possiblyUnclear = entry.decided >= 5 && rejectionRate >= 0.4;

    results.push({
      code: entry.code,
      title: entry.title,
      decided: entry.decided,
      rejected: entry.rejected,
      rejection_rate: rejectionRate,
      rejectionRate,
      possibly_unclear: possiblyUnclear,
      possiblyUnclear,
    });
  }

  results.sort((a, b) => {
    if (b.rejection_rate !== a.rejection_rate) {
      return b.rejection_rate - a.rejection_rate;
    }
    if (b.decided !== a.decided) {
      return b.decided - a.decided;
    }
    return a.code.localeCompare(b.code);
  });

  return results;
}

// ─── 4. Trend By Period ──────────────────────────────────────────────────────

/**
 * Groups first version findings by day (or by ISO week when period is 'week')
 * and returns for each period:
 * - number of submissions
 * - number of findings
 * - findings per submission
 * Includes periods with no data as zeros between the first and last period.
 */
export function trendByPeriod(
  submissions: InsightSubmission[],
  findings: InsightFinding[],
  period: 'day' | 'week' = 'day',
): PeriodTrend[] {
  const subDateMap = new Map<string, string>();
  for (const s of submissions) {
    const dateStr = s.created_at || s.createdAt;
    if (dateStr) {
      subDateMap.set(s.id, dateStr);
    }
  }

  const allDates: Date[] = [];

  for (const s of submissions) {
    const dateStr = s.created_at || s.createdAt;
    if (dateStr) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) allDates.push(d);
    }
  }

  for (const f of findings) {
    if (!isFirstVersionFinding(f)) continue;
    let dateStr = f.created_at || f.createdAt;
    if (!dateStr) {
      const subId = f.submission_id || f.submissionId;
      if (subId) {
        dateStr = subDateMap.get(subId);
      }
    }
    if (dateStr) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) allDates.push(d);
    }
  }

  if (allDates.length === 0) {
    return [];
  }

  let minTime = allDates[0].getTime();
  let maxTime = allDates[0].getTime();
  for (const d of allDates) {
    const t = d.getTime();
    if (t < minTime) minTime = t;
    if (t > maxTime) maxTime = t;
  }

  const minDate = new Date(minTime);
  const maxDate = new Date(maxTime);

  const getKey = period === 'week' ? getISOWeekKey : getISODayKey;

  const submissionsCountMap = new Map<string, number>();
  for (const s of submissions) {
    const dateStr = s.created_at || s.createdAt;
    if (dateStr) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        const k = getKey(d);
        submissionsCountMap.set(k, (submissionsCountMap.get(k) || 0) + 1);
      }
    }
  }

  const findingsCountMap = new Map<string, number>();
  for (const f of findings) {
    if (!isFirstVersionFinding(f)) continue;
    let dateStr = f.created_at || f.createdAt;
    if (!dateStr) {
      const subId = f.submission_id || f.submissionId;
      if (subId) {
        dateStr = subDateMap.get(subId);
      }
    }
    if (dateStr) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        const k = getKey(d);
        findingsCountMap.set(k, (findingsCountMap.get(k) || 0) + 1);
      }
    }
  }

  const periodKeys: string[] = [];

  if (period === 'day') {
    const curr = new Date(
      Date.UTC(minDate.getUTCFullYear(), minDate.getUTCMonth(), minDate.getUTCDate()),
    );
    const end = new Date(
      Date.UTC(maxDate.getUTCFullYear(), maxDate.getUTCMonth(), maxDate.getUTCDate()),
    );
    while (curr.getTime() <= end.getTime()) {
      periodKeys.push(getISODayKey(curr));
      curr.setUTCDate(curr.getUTCDate() + 1);
    }
  } else {
    // Week period
    const curr = new Date(
      Date.UTC(minDate.getUTCFullYear(), minDate.getUTCMonth(), minDate.getUTCDate()),
    );
    const dayOfWeek = curr.getUTCDay() || 7;
    curr.setUTCDate(curr.getUTCDate() - (dayOfWeek - 1)); // Adjust to Monday

    const end = new Date(
      Date.UTC(maxDate.getUTCFullYear(), maxDate.getUTCMonth(), maxDate.getUTCDate()),
    );
    const endDayOfWeek = end.getUTCDay() || 7;
    end.setUTCDate(end.getUTCDate() - (endDayOfWeek - 1)); // Adjust to Monday

    while (curr.getTime() <= end.getTime()) {
      periodKeys.push(getISOWeekKey(curr));
      curr.setUTCDate(curr.getUTCDate() + 7);
    }
  }

  const results: PeriodTrend[] = [];
  for (const p of periodKeys) {
    const subs = submissionsCountMap.get(p) || 0;
    const finds = findingsCountMap.get(p) || 0;
    const rate = subs > 0 ? finds / subs : 0;
    results.push({
      period: p,
      submissions: subs,
      findings: finds,
      findings_per_submission: rate,
      findingsPerSubmission: rate,
    });
  }

  return results;
}
