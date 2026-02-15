/**
 * Simple in-memory rate limiter for the GenAI Gateway.
 * Limits requests per IP to protect the upstream Anthropic API.
 */

const windowMs = 60 * 1000; // 1 minute window
const maxRequests = parseInt(process.env.RATE_LIMIT_RPM || '60', 10);

const requestCounts = new Map();

// Clean up expired entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of requestCounts) {
    if (now - entry.windowStart > windowMs) {
      requestCounts.delete(key);
    }
  }
}, windowMs);

function rateLimiter(req, res, next) {
  const key = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();

  let entry = requestCounts.get(key);
  if (!entry || now - entry.windowStart > windowMs) {
    entry = { windowStart: now, count: 0 };
    requestCounts.set(key, entry);
  }

  entry.count++;

  if (entry.count > maxRequests) {
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded. Please slow down.',
      retryAfterMs: windowMs - (now - entry.windowStart),
    });
  }

  next();
}

module.exports = rateLimiter;
