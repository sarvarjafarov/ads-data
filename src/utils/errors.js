/**
 * Custom Error Classes
 * Standardized error handling for the application
 */

/**
 * Base API Error class
 */
class APIError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = true; // Distinguish from programming errors
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation Error (400)
 */
class ValidationError extends APIError {
  constructor(message, errors = []) {
    super(message, 400);
    this.errors = errors;
  }
}

/**
 * Authentication Error (401)
 */
class AuthenticationError extends APIError {
  constructor(message = 'Authentication required') {
    super(message, 401);
  }
}

/**
 * Authorization Error (403)
 */
class AuthorizationError extends APIError {
  constructor(message = 'Access denied') {
    super(message, 403);
  }
}

/**
 * Not Found Error (404)
 */
class NotFoundError extends APIError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
  }
}

/**
 * Conflict Error (409)
 */
class ConflictError extends APIError {
  constructor(message = 'Resource already exists') {
    super(message, 409);
  }
}

/**
 * Rate Limit Error (429)
 */
class RateLimitError extends APIError {
  constructor(message = 'Too many requests') {
    super(message, 429);
  }
}

/**
 * External Service Error (502)
 */
class ExternalServiceError extends APIError {
  constructor(service, message = 'External service unavailable') {
    super(`${service}: ${message}`, 502);
    this.service = service;
  }
}

/**
 * Database Error (500)
 */
class DatabaseError extends APIError {
  constructor(message = 'Database operation failed') {
    super(message, 500);
  }
}

/**
 * File Processing Error (422)
 */
class FileProcessingError extends APIError {
  constructor(message = 'Failed to process file') {
    super(message, 422);
  }
}

/**
 * Sync Error (custom for Google Sheets sync)
 */
class SyncError extends APIError {
  constructor(message, sourceId) {
    super(message, 500);
    this.sourceId = sourceId;
  }
}

/**
 * Error handler utility
 * Wraps async route handlers to catch errors
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validate required fields
 */
const validateRequired = (fields, body) => {
  const missing = [];
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      missing.push(field);
    }
  }

  if (missing.length > 0) {
    throw new ValidationError(
      `Missing required fields: ${missing.join(', ')}`,
      missing.map(field => ({ field, message: 'Required' }))
    );
  }
};

/**
 * Validate data types
 */
const validateTypes = (schema, body) => {
  const errors = [];

  for (const [field, type] of Object.entries(schema)) {
    if (body[field] !== undefined) {
      const value = body[field];
      let valid = true;

      switch (type) {
        case 'string':
          valid = typeof value === 'string';
          break;
        case 'number':
          valid = typeof value === 'number' && !isNaN(value);
          break;
        case 'boolean':
          valid = typeof value === 'boolean';
          break;
        case 'array':
          valid = Array.isArray(value);
          break;
        case 'object':
          valid = typeof value === 'object' && value !== null && !Array.isArray(value);
          break;
        case 'uuid':
          valid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
          break;
        case 'email':
          valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
          break;
        case 'url':
          try {
            new URL(value);
            valid = true;
          } catch {
            valid = false;
          }
          break;
        case 'date':
          valid = !isNaN(Date.parse(value));
          break;
      }

      if (!valid) {
        errors.push({ field, message: `Must be of type ${type}` });
      }
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('Validation failed', errors);
  }
};

/**
 * Validate numeric ranges
 */
const validateRange = (field, value, min, max) => {
  if (value < min || value > max) {
    throw new ValidationError(
      `${field} must be between ${min} and ${max}`,
      [{ field, message: `Must be between ${min} and ${max}` }]
    );
  }
};

/**
 * Validate enum values
 */
const validateEnum = (field, value, allowedValues) => {
  if (!allowedValues.includes(value)) {
    throw new ValidationError(
      `${field} must be one of: ${allowedValues.join(', ')}`,
      [{ field, message: `Must be one of: ${allowedValues.join(', ')}` }]
    );
  }
};

module.exports = {
  // Error classes
  APIError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ExternalServiceError,
  DatabaseError,
  FileProcessingError,
  SyncError,

  // Utilities
  asyncHandler,
  validateRequired,
  validateTypes,
  validateRange,
  validateEnum,
};
