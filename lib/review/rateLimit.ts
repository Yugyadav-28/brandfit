// In-memory sliding window rate limiter: 10 review runs per user per 10 minutes
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_RUNS = 10;

const userReviewTimestamps = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds?: number;
}

export function checkReviewRateLimit(userId: string): RateLimitResult {
  const now = Date.now();
  const timestamps = userReviewTimestamps.get(userId) || [];
  
  // Prune timestamps older than 10 minutes
  const validTimestamps = timestamps.filter((t) => now - t < WINDOW_MS);

  if (validTimestamps.length >= MAX_RUNS) {
    const oldestTimestamp = validTimestamps[0];
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldestTimestamp + WINDOW_MS - now) / 1000),
    );
    userReviewTimestamps.set(userId, validTimestamps);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  validTimestamps.push(now);
  userReviewTimestamps.set(userId, validTimestamps);

  // Periodically cleanup stale users if the map grows
  if (userReviewTimestamps.size > 1000) {
    for (const [key, list] of userReviewTimestamps.entries()) {
      if (list.every((t) => now - t >= WINDOW_MS)) {
        userReviewTimestamps.delete(key);
      }
    }
  }

  return {
    allowed: true,
    remaining: MAX_RUNS - validTimestamps.length,
  };
}
