/**
 * Rate Limiting Middleware
 * Protects API endpoints from abuse
 */

const { query } = require('../config/database');

/**
 * Rate limit configuration by endpoint type
 */
const RATE_LIMITS = {
  default: { requests: 100, window: 60 }, // 100 requests per minute
  auth: { requests: 5, window: 60 }, // 5 login attempts per minute
  sync: { requests: 10, window: 300 }, // 10 syncs per 5 minutes
  export: { requests: 20, window: 300 }, // 20 exports per 5 minutes
  search: { requests: 50, window: 60 }, // 50 searches per minute
};

/**
 * Determine rate limit type from endpoint
 */
const getRateLimitType = (path) => {
  if (path.includes('/auth/login') || path.includes('/auth/register')) {
    return 'auth';
  }
  if (path.includes('/sync')) {
    return 'sync';
  }
  if (path.includes('/export')) {
    return 'export';
  }
  if (path.includes('/search')) {
    return 'search';
  }
  return 'default';
};

/**
 * Rate limiting middleware
 */
const rateLimit = (options = {}) => {
  return async (req, res, next) => {
    try {
      const endpoint = req.path;
      const limitType = getRateLimitType(endpoint);
      const limit = RATE_LIMITS[limitType];
      const userId = req.user?.id;
      const workspaceId = req.params?.workspaceId;
      const identifier = userId || req.ip;

      // Skip rate limiting for health checks
      if (endpoint.includes('/health')) {
        return next();
      }

      const now = new Date();
      const windowStart = new Date(now.getTime() - limit.window * 1000);

      // Check current request count in window
      const result = await query(
        `SELECT SUM(request_count) as total_requests
         FROM api_rate_limits
         WHERE endpoint = $1
         AND (user_id = $2 OR (user_id IS NULL AND $2::uuid IS NULL))
         AND window_start >= $3`,
        [endpoint, userId, windowStart]
      );

      const currentRequests = parseInt(result.rows[0]?.total_requests || 0);

      if (currentRequests >= limit.requests) {
        return res.status(429).json({
          success: false,
          message: 'Rate limit exceeded',
          retryAfter: limit.window,
        });
      }

      // Record this request
      await query(
        `INSERT INTO api_rate_limits (
          user_id, workspace_id, endpoint, request_count, window_start, window_end
        ) VALUES ($1, $2, $3, 1, NOW(), NOW() + INTERVAL '${limit.window} seconds')`,
        [userId, workspaceId, endpoint]
      );

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', limit.requests);
      res.setHeader('X-RateLimit-Remaining', limit.requests - currentRequests - 1);
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + limit.window * 1000).toISOString());

      next();
    } catch (error) {
      console.error('Rate limit error:', error);
      // On error, allow request through but log the issue
      next();
    }
  };
};

/**
 * Clean up old rate limit records
 */
const cleanupRateLimits = async () => {
  try {
    // Delete records older than 1 hour
    await query(
      `DELETE FROM api_rate_limits
       WHERE window_end < NOW() - INTERVAL '1 hour'`
    );
  } catch (error) {
    console.error('Rate limit cleanup error:', error);
  }
};

// Run cleanup every hour
setInterval(cleanupRateLimits, 3600000);

module.exports = rateLimit;
