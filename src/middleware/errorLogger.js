/**
 * Error Logging Middleware
 * Comprehensive error tracking and logging
 */

const { query } = require('../config/database');

/**
 * Log error to database
 */
const logError = async (error, req, statusCode = 500) => {
  try {
    await query(
      `INSERT INTO error_logs (
        user_id,
        workspace_id,
        error_type,
        error_message,
        stack_trace,
        request_url,
        request_method,
        request_body,
        status_code,
        ip_address,
        user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        req.user?.id || null,
        req.params?.workspaceId || null,
        error.name || 'Error',
        error.message || 'Unknown error',
        error.stack || null,
        req.originalUrl || req.url,
        req.method,
        JSON.stringify(req.body || {}),
        statusCode,
        req.ip || req.connection?.remoteAddress,
        req.get('user-agent') || null,
      ]
    );
  } catch (logError) {
    console.error('Failed to log error to database:', logError);
  }
};

/**
 * Error handler middleware
 */
const errorHandler = async (err, req, res, next) => {
  console.error('Error occurred:', err);

  // Determine status code
  const statusCode = err.statusCode || err.status || 500;

  // Log error to database
  await logError(err, req, statusCode);

  // Don't expose internal errors in production
  const message =
    process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'Internal server error'
      : err.message;

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      error: err,
    }),
  });
};

/**
 * Request logger middleware
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();

  // Log when response finishes
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `${req.method} ${req.originalUrl || req.url} ${res.statusCode} ${duration}ms`
    );

    // Log slow requests (> 2 seconds)
    if (duration > 2000) {
      console.warn(`Slow request detected: ${req.method} ${req.originalUrl || req.url} took ${duration}ms`);
    }
  });

  next();
};

/**
 * Not found handler
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.originalUrl || req.url,
  });
};

/**
 * Clean up old error logs
 */
const cleanupErrorLogs = async () => {
  try {
    // Keep error logs for 30 days
    await query(
      `DELETE FROM error_logs
       WHERE created_at < NOW() - INTERVAL '30 days'`
    );
  } catch (error) {
    console.error('Error log cleanup failed:', error);
  }
};

// Run cleanup daily
setInterval(cleanupErrorLogs, 86400000);

module.exports = {
  errorHandler,
  requestLogger,
  notFoundHandler,
  logError,
};
