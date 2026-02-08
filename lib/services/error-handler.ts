/**
 * Error Handler Service
 * Centralized error handling and logging for the application
 * Implements consistent error responses and error tracking
 */

import { logger } from '@/lib/utils/logger';
import { UserFacingError } from '@/src/application/shared/user-facing-error';

/**
 * Standard error response format
 */
export interface ErrorResponse {
  error: {
    message: string;
    code: string;
    statusCode: number;
    details?: unknown;
    timestamp: string;
  };
}

/**
 * Error codes for consistent error handling
 */
export const ERROR_CODES = {
  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_TOKEN: 'INVALID_TOKEN',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  
  // Database
  DATABASE_ERROR: 'DATABASE_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  CONSTRAINT_VIOLATION: 'CONSTRAINT_VIOLATION',
  
  // Business Logic
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  LIMIT_EXCEEDED: 'LIMIT_EXCEEDED',
  INVALID_OPERATION: 'INVALID_OPERATION',
  
  // External Services
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  STRIPE_ERROR: 'STRIPE_ERROR',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // General
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

/**
 * Custom application error class
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    code: ErrorCode = ERROR_CODES.INTERNAL_ERROR,
    statusCode: number = 500,
    isOperational: boolean = true,
    details?: unknown
  ) {
    super(message);
    
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Specific error classes
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, ERROR_CODES.VALIDATION_ERROR, 400, true, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, ERROR_CODES.UNAUTHORIZED, 401, true);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, ERROR_CODES.FORBIDDEN, 403, true);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, ERROR_CODES.NOT_FOUND, 404, true);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, ERROR_CODES.DUPLICATE_ENTRY, 409, true);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, ERROR_CODES.RATE_LIMIT_EXCEEDED, 429, true);
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, details?: unknown) {
    super(
      `${service} error: ${message}`,
      ERROR_CODES.EXTERNAL_SERVICE_ERROR,
      502,
      true,
      details
    );
  }
}

/**
 * Format error response
 */
export function formatErrorResponse(error: unknown): ErrorResponse {
  // Use UserFacingError if available, otherwise map to user-friendly message
  const userFacingError = error instanceof UserFacingError 
    ? error 
    : UserFacingError.fromError(error);
  
  const userMessage = userFacingError.userMessage;
  const timestamp = new Date().toISOString();

  // Handle AppError instances (use user message)
  if (error instanceof AppError) {
    return {
      error: {
        message: userMessage,
        code: error.code,
        statusCode: error.statusCode,
        details: error.details,
        timestamp,
      },
    };
  }

  // Handle standard Error instances (use user message)
  if (error instanceof Error) {
    return {
      error: {
        message: userMessage,
        code: ERROR_CODES.INTERNAL_ERROR,
        statusCode: 500,
        timestamp,
      },
    };
  }

  // Handle unknown error types (use user message)
  return {
    error: {
      message: userMessage,
      code: ERROR_CODES.UNKNOWN_ERROR,
      statusCode: 500,
      details: error,
      timestamp,
    },
  };
}

/**
 * Log error with appropriate level
 */
export function logError(error: unknown, context?: Record<string, unknown>): void {
  const errorInfo = {
    ...(error instanceof AppError ? {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      isOperational: error.isOperational,
      details: error.details,
      stack: error.stack,
    } : error instanceof Error ? {
      message: error.message,
      name: error.name,
      stack: error.stack,
    } : {
      error,
    }),
    ...context,
  };

  // Log based on error type
  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      logger.error('[AppError]', errorInfo);
    } else if (error.statusCode >= 400) {
      logger.warn('[AppError]', errorInfo);
    } else {
      logger.info('[AppError]', errorInfo);
    }
  } else {
    logger.error('[UnhandledError]', errorInfo);
  }
}

/**
 * Handle error and return formatted response
 * Use this in API routes for consistent error handling
 * Automatically uses user-friendly messages from UserFacingError
 */
export function handleError(error: unknown, context?: Record<string, unknown>): ErrorResponse {
  // Log the error
  logError(error, context);

  // Return formatted response
  return formatErrorResponse(error);
}

/**
 * Convert Supabase errors to AppError
 */
export function convertSupabaseError(error: any): AppError {
  const message = error.message || 'Database error';
  const code = error.code;

  // Handle specific Supabase error codes
  switch (code) {
    case '23505': // unique_violation
      return new ConflictError('Record already exists');
    
    case '23503': // foreign_key_violation
      return new AppError(
        'Referenced record does not exist',
        ERROR_CODES.CONSTRAINT_VIOLATION,
        400
      );
    
    case '23502': // not_null_violation
      return new ValidationError('Required field is missing');
    
    case 'PGRST116': // Row not found
      return new NotFoundError();
    
    case '42501': // insufficient_privilege
      return new ForbiddenError('Insufficient permissions');
    
    default:
      return new AppError(
        message,
        ERROR_CODES.DATABASE_ERROR,
        500,
        true,
        { originalError: error }
      );
  }
}

/**
 * Convert Stripe errors to AppError
 */
export function convertStripeError(error: any): AppError {
  const message = error.message || 'Payment processing error';
  
  return new AppError(
    message,
    ERROR_CODES.STRIPE_ERROR,
    error.statusCode || 500,
    true,
    {
      type: error.type,
      code: error.code,
      param: error.param,
    }
  );
}

/**
 * Async error wrapper for API routes
 * Automatically catches and handles errors
 */
export function asyncHandler<T extends (...args: any[]) => Promise<any>>(
  fn: T
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    try {
      return await fn(...args);
    } catch (error) {
      throw error instanceof AppError ? error : new AppError(
        error instanceof Error ? error.message : 'Unknown error',
        ERROR_CODES.INTERNAL_ERROR,
        500,
        false
      );
    }
  };
}

/**
 * Validate and throw if validation fails
 */
export function validateOrThrow(
  condition: boolean,
  message: string,
  details?: unknown
): asserts condition {
  if (!condition) {
    throw new ValidationError(message, details);
  }
}

/**
 * Assert not null or throw
 */
export function assertNotNull<T>(
  value: T | null | undefined,
  resource: string = 'Resource'
): asserts value is T {
  if (value === null || value === undefined) {
    throw new NotFoundError(resource);
  }
}

/**
 * Check authorization or throw
 */
export function assertAuthorized(
  condition: boolean,
  message: string = 'Unauthorized'
): asserts condition {
  if (!condition) {
    throw new UnauthorizedError(message);
  }
}

/**
 * Check permission or throw
 */
export function assertPermission(
  condition: boolean,
  message: string = 'Forbidden'
): asserts condition {
  if (!condition) {
    throw new ForbiddenError(message);
  }
}

