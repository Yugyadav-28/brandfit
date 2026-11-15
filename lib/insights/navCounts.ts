import { createAdminClient } from "@/lib/supabase/admin";

export interface NavCounts {
  reviewWaitingCount: number;
  myChangesCount: number;
}

/**
 * Fetches navigation badge counts in a single cheap server query filtered by company.
 *
 * - Review waiting count:
 *   - For reviewers: posts with status 'in_review'
 *   - For authorised reviewers and employers: posts with status 'in_review' or 'escalated'
 * - My posts count:
 *   - Current user's posts with status 'changes_requested'
 */
export async function getNavCounts(
  companyId: string,
  userId: string,
  role?: string | null,
): Promise<NavCounts> {
  if (!companyId) {
    return { reviewWaitingCount: 0, myChangesCount: 0 };
  }

  const isAuthorisedOrEmployer =
    role === "employer" || role === "authorised_reviewer";
  const isReviewer = role === "reviewer";
  const canReview = isAuthorisedOrEmployer || isReviewer;

  const admin = createAdminClient();

  // One cheap query selecting only status and author_id, strictly filtered by company_id
  const { data: submissions, error } = await admin
    .from("submissions")
    .select("status, author_id")
    .eq("company_id", companyId)
    .in("status", ["in_review", "escalated", "changes_requested"]);

  if (error || !submissions) {
    if (error) {
      console.error("Failed to fetch nav counts:", error);
    }
    return { reviewWaitingCount: 0, myChangesCount: 0 };
  }

  let inReviewCount = 0;
  let escalatedCount = 0;
  let myChangesCount = 0;

  for (const s of submissions) {
    if (s.status === "in_review") {
      inReviewCount++;
    } else if (s.status === "escalated") {
      escalatedCount++;
    }
    if (s.author_id === userId && s.status === "changes_requested") {
      myChangesCount++;
    }
  }

  let reviewWaitingCount = 0;
  if (canReview) {
    reviewWaitingCount = isAuthorisedOrEmployer
      ? inReviewCount + escalatedCount
      : inReviewCount;
  }

  return {
    reviewWaitingCount,
    myChangesCount,
  };
}
