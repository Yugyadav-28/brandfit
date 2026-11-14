import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Returns true when the latest version of the submission has at least one finding
 * whose rule_code matches (case insensitive) a rule of the same company with
 * needs_escalation true.
 */
export async function needsEscalation(submissionId: string): Promise<boolean> {
  const admin = createAdminClient();

  // 1. Fetch submission to determine company_id
  const { data: submission, error: subError } = await admin
    .from('submissions')
    .select('company_id')
    .eq('id', submissionId)
    .maybeSingle();

  if (subError || !submission) {
    return false;
  }

  // 2. Fetch the latest version of the submission
  const { data: latestVersion, error: verError } = await admin
    .from('versions')
    .select('id')
    .eq('submission_id', submissionId)
    .order('version_no', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (verError || !latestVersion) {
    return false;
  }

  // 3. Fetch findings for this latest version
  const { data: findings, error: findError } = await admin
    .from('findings')
    .select('rule_code')
    .eq('version_id', latestVersion.id);

  if (findError || !findings || findings.length === 0) {
    return false;
  }

  // Normalize finding rule codes to uppercase
  const findingCodes = new Set<string>();
  for (const f of findings) {
    if (f.rule_code && typeof f.rule_code === 'string') {
      const code = f.rule_code.trim().toUpperCase();
      if (code) {
        findingCodes.add(code);
      }
    }
  }

  if (findingCodes.size === 0) {
    return false;
  }

  // 4. Fetch rules for the company where needs_escalation is true
  const { data: sensitiveRules, error: ruleError } = await admin
    .from('rules')
    .select('code')
    .eq('company_id', submission.company_id)
    .eq('needs_escalation', true);

  if (ruleError || !sensitiveRules || sensitiveRules.length === 0) {
    return false;
  }

  // 5. Check if any finding's rule_code matches a sensitive rule (case insensitive)
  return sensitiveRules.some(
    (r) =>
      r.code &&
      typeof r.code === 'string' &&
      findingCodes.has(r.code.trim().toUpperCase()),
  );
}
