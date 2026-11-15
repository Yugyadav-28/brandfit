import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export const RATE_LIMIT_MESSAGE =
  'You have run many reviews in a short time. Please wait a few minutes and try again.';

export interface RateLimitResult {
  allowed: boolean;
  message?: string;
  count?: number;
}

/**
 * Checks if the user has reached the limit of 10 review runs
 * (review_run and upload_reviewed audit rows) per 10 minutes,
 * counted from audit_log so it works on serverless hosting.
 */
export async function checkReviewRateLimit(
  userId: string,
): Promise<RateLimitResult> {
  try {
    const admin = createAdminClient();
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { count, error } = await admin
      .from('audit_log')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('action', ['review_run', 'upload_reviewed'])
      .gte('created_at', tenMinutesAgo);

    if (error) {
      console.error('Error querying audit_log for review rate limit:', error);
      // If error querying, allow the request so we don't break functionality
      return { allowed: true };
    }

    if (count !== null && count >= 10) {
      return {
        allowed: false,
        message: RATE_LIMIT_MESSAGE,
        count,
      };
    }

    return {
      allowed: true,
      count: count ?? 0,
    };
  } catch (err) {
    console.error('Unexpected error checking review rate limit:', err);
    return { allowed: true };
  }
}
