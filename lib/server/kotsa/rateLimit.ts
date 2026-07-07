interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitBuckets = new Map<string, RateLimitEntry>();

const defaultWindowMs = 60 * 1000;
const defaultMaxRequests = 5;

const getLimitNumber = (key: string, fallback: number) => {
  const value = Number(process.env[key]);

  return Number.isFinite(value) && value > 0 ? value : fallback;
};

export const checkKotsaRateLimit = (key: string) => {
  const now = Date.now();
  const windowMs = getLimitNumber("KOTSA_RATE_LIMIT_WINDOW_MS", defaultWindowMs);
  const maxRequests = getLimitNumber(
    "KOTSA_RATE_LIMIT_MAX_REQUESTS",
    defaultMaxRequests,
  );
  const current = rateLimitBuckets.get(key);

  if (!current || current.resetAt <= now) {
    const resetAt = now + windowMs;
    rateLimitBuckets.set(key, { count: 1, resetAt });

    return { allowed: true, remaining: maxRequests - 1, resetAt };
  }

  if (current.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;

  return {
    allowed: true,
    remaining: Math.max(maxRequests - current.count, 0),
    resetAt: current.resetAt,
  };
};
