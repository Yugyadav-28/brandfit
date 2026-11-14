import { Suspense } from 'react';
import { requireUser, getMyMemberships } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  MySubmissionsClient,
  MySubmissionItem,
  RuleMistakeStat,
} from './my-submissions-client';

async function MySubmissionsContent() {
  const user = await requireUser();
  const memberships = await getMyMemberships();
  const admin = createAdminClient();

  // 1. Fetch user's submissions
  const { data: userSubmissions, error: subError } = await admin
    .from('submissions')
    .select('*')
    .eq('author_id', user.id)
    .order('updated_at', { ascending: false });

  if (subError) {
    console.error('Error fetching user submissions:', subError);
  }

  const submissions = userSubmissions ?? [];
  const subIds = submissions.map((s) => s.id);

  // Map company names
  const companyMap = new Map(
    memberships.map((m) => [m.companyId, m.displayName || m.name || m.companyId]),
  );

  let versionCountMap = new Map<string, number>();
  let latestVersionIdMap = new Map<string, string>();
  let latestFindingsCountMap = new Map<string, number>();
  let topMistakes: RuleMistakeStat[] = [];
  let totalFindingsCount = 0;
  let latestNotesMap = new Map<
    string,
    { note: string | null; decision: string | null }
  >();

  if (subIds.length > 0) {
    // 2. Fetch all versions for user's submissions
    const { data: allVersions } = await admin
      .from('versions')
      .select('id, submission_id, version_no')
      .in('submission_id', subIds)
      .order('version_no', { ascending: false });

    const versions = allVersions ?? [];

    for (const v of versions) {
      // Version count
      versionCountMap.set(
        v.submission_id,
        (versionCountMap.get(v.submission_id) || 0) + 1,
      );

      // Latest version id (first one encountered per sub since ordered version_no desc)
      if (!latestVersionIdMap.has(v.submission_id)) {
        latestVersionIdMap.set(v.submission_id, v.id);
      }
    }

    const allVersionIds = versions.map((v) => v.id);
    const latestVersionIds = Array.from(latestVersionIdMap.values());

    // 3. Fetch findings for all versions to calculate mistakes and latest version findings
    if (allVersionIds.length > 0) {
      const { data: allFindings } = await admin
        .from('findings')
        .select('id, version_id, rule_code')
        .in('version_id', allVersionIds);

      const findings = allFindings ?? [];
      totalFindingsCount = findings.length;

      // Calculate findings count for latest versions
      const latestSet = new Set(latestVersionIds);
      for (const f of findings) {
        if (latestSet.has(f.version_id)) {
          latestFindingsCountMap.set(
            f.version_id,
            (latestFindingsCountMap.get(f.version_id) || 0) + 1,
          );
        }
      }

      // Calculate "Your mistakes by rule" across all findings
      const ruleCodeCount = new Map<string, number>();
      for (const f of findings) {
        if (!f.rule_code) continue;
        const code = f.rule_code.trim().toUpperCase();
        ruleCodeCount.set(code, (ruleCodeCount.get(code) || 0) + 1);
      }

      // Sort by count descending and take top 3
      const sortedMistakes = Array.from(ruleCodeCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

      // Lookup rule/fact titles for the top mistakes
      const topCodes = sortedMistakes.map(([code]) => code);
      if (topCodes.length > 0) {
        const [rulesRes, factsRes] = await Promise.all([
          admin.from('rules').select('code, title, category').in('code', topCodes),
          admin.from('facts').select('code, statement').in('code', topCodes),
        ]);

        const ruleTitleMap = new Map<string, { title: string; category?: string }>();
        for (const r of rulesRes.data ?? []) {
          ruleTitleMap.set(r.code.toUpperCase(), {
            title: r.title || 'Brand guideline rule',
            category: r.category,
          });
        }
        for (const f of factsRes.data ?? []) {
          ruleTitleMap.set(f.code.toUpperCase(), {
            title: f.statement || 'Approved brand fact',
            category: 'facts',
          });
        }

        topMistakes = sortedMistakes.map(([code, count]) => {
          if (code === 'TERM') {
            return {
              rule_code: 'TERM',
              title: 'Brand Terminology Standard',
              count,
              category: 'terminology',
            };
          }
          const info = ruleTitleMap.get(code);
          return {
            rule_code: code,
            title: info?.title || `Rule guideline ${code}`,
            count,
            category: info?.category || 'general',
          };
        });
      }
    }

    // 4. Fetch latest reviewer notes from approvals
    const { data: approvalsData } = await admin
      .from('approvals')
      .select('submission_id, decision, note, created_at')
      .in('submission_id', subIds)
      .order('created_at', { ascending: false });

    for (const a of approvalsData ?? []) {
      if (!latestNotesMap.has(a.submission_id)) {
        latestNotesMap.set(a.submission_id, {
          note: a.note || null,
          decision: a.decision || null,
        });
      }
    }

    // 5. Fetch escalations for user submissions (to retrieve resolution notes)
    const { data: escalationsData } = await admin
      .from('escalations')
      .select('submission_id, status, reason, resolution_note, created_at, resolved_at')
      .in('submission_id', subIds)
      .order('created_at', { ascending: false });

    const latestEscalationMap = new Map<
      string,
      { reason: string; resolution_note: string | null; status: string }
    >();
    for (const esc of escalationsData ?? []) {
      if (!latestEscalationMap.has(esc.submission_id)) {
        latestEscalationMap.set(esc.submission_id, {
          reason: esc.reason,
          resolution_note: esc.resolution_note || null,
          status: esc.status,
        });
      }
    }

    // Build submission items
    const items: MySubmissionItem[] = submissions.map((s) => {
      const vCount = versionCountMap.get(s.id) || 1;
      const latestVId = latestVersionIdMap.get(s.id);
      const findingsCount = latestVId
        ? latestFindingsCountMap.get(latestVId) || 0
        : 0;
      const approvalInfo = latestNotesMap.get(s.id);
      const escInfo = latestEscalationMap.get(s.id);

      return {
        id: s.id,
        title: s.title,
        status: s.status,
        company_id: s.company_id,
        company_name: companyMap.get(s.company_id),
        versionCount: vCount,
        latestFindingsCount: findingsCount,
        updated_at: s.updated_at,
        created_at: s.created_at,
        latestReviewerNote: approvalInfo?.note || null,
        latestDecision: approvalInfo?.decision || null,
        resolutionNote: escInfo?.resolution_note || null,
      };
    });

    return (
      <MySubmissionsClient
        submissions={items}
        topMistakes={topMistakes}
        totalFindingsCount={totalFindingsCount}
      />
    );
  }

  // If no submissions
  return (
    <MySubmissionsClient
      submissions={[]}
      topMistakes={[]}
      totalFindingsCount={0}
    />
  );
}

export default function MySubmissionsPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 py-16 text-center text-sm text-muted-foreground">
          Loading your submissions...
        </div>
      }
    >
      <MySubmissionsContent />
    </Suspense>
  );
}
