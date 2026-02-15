/**
 * Usage Logger Middleware
 * Tracks token usage, latency, and model calls across all AI endpoints.
 * Stores metrics in memory; expose via GET /metrics for monitoring.
 */

const metrics = {
  totalRequests: 0,
  totalTokens: 0,
  requestsByEndpoint: {},
  errors: 0,
  startedAt: new Date().toISOString(),
};

function usageLogger(req, res, next) {
  const start = Date.now();
  metrics.totalRequests++;

  const endpoint = `${req.method} ${req.route?.path || req.path}`;
  if (!metrics.requestsByEndpoint[endpoint]) {
    metrics.requestsByEndpoint[endpoint] = { count: 0, totalLatencyMs: 0, totalTokens: 0 };
  }
  metrics.requestsByEndpoint[endpoint].count++;

  // Intercept the response to capture token usage
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    const latency = Date.now() - start;
    metrics.requestsByEndpoint[endpoint].totalLatencyMs += latency;

    if (body && body.tokensUsed) {
      metrics.totalTokens += body.tokensUsed;
      metrics.requestsByEndpoint[endpoint].totalTokens += body.tokensUsed;
    }

    if (res.statusCode >= 400) {
      metrics.errors++;
    }

    return originalJson(body);
  };

  next();
}

function getMetrics() {
  return {
    ...metrics,
    uptimeMs: Date.now() - new Date(metrics.startedAt).getTime(),
  };
}

module.exports = { usageLogger, getMetrics };
