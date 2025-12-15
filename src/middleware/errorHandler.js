const { query } = require('../config/database');
const { APIError } = require('../utils/errors');

/**
 * Log error to database
 */
const logError = async (error, req, statusCode) => {
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
 * Enhanced error handler middleware
 */
const errorHandler = async (err, req, res, next) => {
  // Log error details
  console.error('Error occurred:', {
    name: err.name,
    message: err.message,
    statusCode: err.statusCode,
    isOperational: err.isOperational,
    path: req.path,
    method: req.method,
  });

  // Determine status code
  let statusCode = err.statusCode || err.status || 500;

  // Handle specific error types
  if (err.name === 'ValidationError' && err.errors) {
    // Already a custom ValidationError
    statusCode = 400;
  } else if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
    // JWT errors
    statusCode = 401;
  } else if (err.name === 'MulterError') {
    // File upload errors
    statusCode = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      err.message = 'File size exceeds the limit of 50MB';
    }
  } else if (err.code === '23505') {
    // PostgreSQL unique violation
    statusCode = 409;
    err.message = 'Resource already exists';
  } else if (err.code === '23503') {
    // PostgreSQL foreign key violation
    statusCode = 400;
    err.message = 'Invalid reference to related resource';
  } else if (err.code === '22P02') {
    // PostgreSQL invalid input syntax
    statusCode = 400;
    err.message = 'Invalid data format';
  }

  // Log error to database for operational errors or 5xx errors
  if ((err.isOperational || statusCode >= 500) && req.path !== '/api/health') {
    await logError(err, req, statusCode);
  }

  // Prepare error response
  const isProduction = process.env.NODE_ENV === 'production';
  const message = isProduction && statusCode === 500 && !err.isOperational
    ? 'Internal server error'
    : err.message || 'Internal server error';

  const errorResponse = {
    success: false,
    error: message,
    statusCode,
  };

  // Add validation errors if present
  if (err.errors && Array.isArray(err.errors)) {
    errorResponse.validationErrors = err.errors;
  }

  // Add stack trace in development
  if (!isProduction) {
    errorResponse.stack = err.stack;
    errorResponse.errorType = err.name;
  }

  // Add request ID if available
  if (req.id) {
    errorResponse.requestId = req.id;
  }

  res.status(statusCode).json(errorResponse);
};

module.exports = errorHandler;
