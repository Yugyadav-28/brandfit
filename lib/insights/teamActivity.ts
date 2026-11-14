/**
 * Team Activity calculation for BrandFit workspace dashboard.
 * Takes plain arrays so it can be tested independently.
 */

export interface Member {
  user_id: string;
  role: string;
  display_name?: string | null;
  email?: string | null;
}

export interface Submission {
  id: string;
  author_id: string;
  created_at?: string;
}

export interface Version {
  id: string;
  submission_id: string;
  version_no?: number;
  created_at?: string;
}

export interface Finding {
  id?: string;
  version_id: string;
  rule_code?: string | null;
  decision?: string | null; // 'accepted' | 'edited' | 'rejected' | 'pending' | null
}

export interface TeamActivityRow {
  user_id: string;
  display_name: string;
  role: string;
  submissions: number;
  total_findings: number;
  accepted: number;
  edited: number;
  rejected: number;
  repeated_mistakes: number;
}

/**
 * Calculates Team Activity rows according to Round 3 definitions:
 * 1. Includes every member who has submitted at least one post, whatever their role,
 *    plus every employee even if they have none.
 * 2. Submissions = number of posts by that person.
 *    Total findings = number of findings in the FIRST version of each of their posts.
 *    Accepted, edited and rejected = the decisions on those findings.
 *    Repeated mistakes = number of rule codes that appear in the first version of
 *    two or more different posts by that person.
 * 3. Shows the person's display name, not only the email.
 */
export function calculateTeamActivity(
  members: Member[],
  submissions: Submission[],
  versions: Version[],
  findings: Finding[],
): TeamActivityRow[] {
  // 1. Group submissions by author_id
  const submissionsByAuthor = new Map<string, Submission[]>();
  for (const s of submissions) {
    const list = submissionsByAuthor.get(s.author_id) ?? [];
    list.push(s);
    submissionsByAuthor.set(s.author_id, list);
  }

  // 2. Identify all relevant members
  const memberMap = new Map<string, Member>();
  for (const m of members) {
    memberMap.set(m.user_id, m);
  }

  // Ensure any author with submissions is included even if not explicitly in members list
  for (const [authorId, subs] of submissionsByAuthor.entries()) {
    if (!memberMap.has(authorId) && subs.length > 0) {
      memberMap.set(authorId, {
        user_id: authorId,
        role: "author",
        display_name: `Member ${authorId.slice(0, 6)}`,
      });
    }
  }

  // Filter members: every employee even with 0 posts + every member of any role with >= 1 post
  const eligibleMembers: Member[] = [];
  for (const m of memberMap.values()) {
    const subs = submissionsByAuthor.get(m.user_id) ?? [];
    const isEmployee = m.role === "employee";
    const hasSubmissions = subs.length > 0;

    if (isEmployee || hasSubmissions) {
      eligibleMembers.push(m);
    }
  }

  // 3. Group versions by submission_id and determine the FIRST version
  const versionsBySubmission = new Map<string, Version[]>();
  for (const v of versions) {
    const list = versionsBySubmission.get(v.submission_id) ?? [];
    list.push(v);
    versionsBySubmission.set(v.submission_id, list);
  }

  // Map each submission to its first version ID (lowest version_no or earliest created_at)
  const firstVersionIdBySubmission = new Map<string, string>();
  for (const [subId, vList] of versionsBySubmission.entries()) {
    if (vList.length === 0) continue;
    const sorted = [...vList].sort((a, b) => {
      if (typeof a.version_no === "number" && typeof b.version_no === "number") {
        return a.version_no - b.version_no;
      }
      if (a.created_at && b.created_at) {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return 0;
    });
    firstVersionIdBySubmission.set(subId, sorted[0].id);
  }

  // 4. Group findings by version_id
  const findingsByVersion = new Map<string, Finding[]>();
  for (const f of findings) {
    const list = findingsByVersion.get(f.version_id) ?? [];
    list.push(f);
    findingsByVersion.set(f.version_id, list);
  }

  // 5. Calculate statistics for each eligible member
  const rows: TeamActivityRow[] = eligibleMembers.map((m) => {
    const userSubs = submissionsByAuthor.get(m.user_id) ?? [];
    const submissionsCount = userSubs.length;

    // Collect findings for the FIRST version of each post
    const firstVersionFindings: Finding[] = [];
    const ruleCodeToPostIds = new Map<string, Set<string>>();

    for (const sub of userSubs) {
      const firstVid = firstVersionIdBySubmission.get(sub.id);
      if (!firstVid) continue;

      const subFindings = findingsByVersion.get(firstVid) ?? [];
      for (const f of subFindings) {
        firstVersionFindings.push(f);

        const code = f.rule_code?.trim();
        if (code) {
          const set = ruleCodeToPostIds.get(code) ?? new Set<string>();
          set.add(sub.id);
          ruleCodeToPostIds.set(code, set);
        }
      }
    }

    const total_findings = firstVersionFindings.length;
    let accepted = 0;
    let edited = 0;
    let rejected = 0;

    for (const f of firstVersionFindings) {
      if (f.decision === "accepted") accepted++;
      else if (f.decision === "edited") edited++;
      else if (f.decision === "rejected") rejected++;
    }

    // Repeated mistakes: number of rule codes that appear in the first version of 2 or more different posts
    let repeated_mistakes = 0;
    for (const postSet of ruleCodeToPostIds.values()) {
      if (postSet.size >= 2) {
        repeated_mistakes++;
      }
    }

    // Show display name, fallback to email or Member
    const displayName = m.display_name?.trim() || m.email?.trim() || "Member";

    return {
      user_id: m.user_id,
      display_name: displayName,
      role: m.role,
      submissions: submissionsCount,
      total_findings,
      accepted,
      edited,
      rejected,
      repeated_mistakes,
    };
  });

  // Sort by submissions descending, then by total_findings descending
  rows.sort((a, b) => {
    if (b.submissions !== a.submissions) {
      return b.submissions - a.submissions;
    }
    return b.total_findings - a.total_findings;
  });

  return rows;
}
