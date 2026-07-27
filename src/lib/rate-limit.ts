type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS_PER_KEY = 8;
const MAX_ENTRIES = 10_000;
const attempts = new Map<string, RateLimitEntry>();
const paymentRequests = new Map<string, RateLimitEntry>();

function cleanup(now: number) {
  for (const [key, entry] of attempts) {
    if (entry.resetAt <= now) attempts.delete(key);
  }

  if (attempts.size <= MAX_ENTRIES) return;
  const oldest = [...attempts.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
  for (const [key] of oldest.slice(0, attempts.size - MAX_ENTRIES)) attempts.delete(key);
}

export function getClientIp(request: Request) {
  // These headers are only used as rate-limit hints, never as an authorization signal.
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function loginRateLimitKeys(email: string, request: Request) {
  return [`login:email:${email.toLowerCase().trim()}`, `login:ip:${getClientIp(request)}`];
}

export function checkLoginRateLimit(keys: string[]) {
  const now = Date.now();
  cleanup(now);
  const blocked = keys
    .map((key) => attempts.get(key))
    .filter((entry): entry is RateLimitEntry => Boolean(entry && entry.resetAt > now && entry.count >= MAX_ATTEMPTS_PER_KEY));

  if (blocked.length === 0) return { allowed: true, retryAfterSeconds: 0 };
  const retryAfterSeconds = Math.max(1, Math.ceil((Math.max(...blocked.map((entry) => entry.resetAt)) - now) / 1000));
  return { allowed: false, retryAfterSeconds };
}

export function registerLoginFailure(keys: string[]) {
  const now = Date.now();
  cleanup(now);
  for (const key of keys) {
    const current = attempts.get(key);
    if (!current || current.resetAt <= now) {
      attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    } else {
      current.count += 1;
    }
  }
}

export function clearLoginFailures(keys: string[]) {
  for (const key of keys) attempts.delete(key);
}

export function checkPaymentRateLimit(userId: string, request: Request) {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const maxRequests = 12;
  const keys = [`payment:user:${userId}`, `payment:ip:${getClientIp(request)}`];

  for (const [key, entry] of paymentRequests) {
    if (entry.resetAt <= now) paymentRequests.delete(key);
  }

  const blocked = keys
    .map((key) => paymentRequests.get(key))
    .filter((entry): entry is RateLimitEntry => Boolean(entry && entry.resetAt > now && entry.count >= maxRequests));
  if (blocked.length) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((Math.max(...blocked.map((entry) => entry.resetAt)) - now) / 1000)),
    };
  }

  for (const key of keys) {
    const current = paymentRequests.get(key);
    if (!current || current.resetAt <= now) paymentRequests.set(key, { count: 1, resetAt: now + windowMs });
    else current.count += 1;
  }
  return { allowed: true, retryAfterSeconds: 0 };
}
