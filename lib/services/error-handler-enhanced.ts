/**
 * Enhanced Error Handler with Sentry Integration
 * Extends the existing error handler with Sentry tracking
 */

import * as Sentry from '@sentry/nextjs';
import { AppError, formatErrorResponse, handleError, logError } from './error-handler';
import type { ErrorResponse } from './error-handler';

/**
 * Enhanced error handler with Sentry integration
 */
export function handleErrorWithSentry(
  error: unknown,
  context?: {
    userId?: string;
    requestId?: string;
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
): ErrorResponse {
  // Format error response using existing handler
  const errorResponse = handleError(error);

  // Send to Sentry if in production
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_SENTRY_DSN) {
    try {
      // Set user context if available
      if (context?.userId) {
        Sentry.setUser({
          id: context.userId,
        });
      }

      // Set tags
      if (context?.tags) {
        Sentry.setTags(context.tags);
      }

      // Set extra context
      if (context?.extra) {
        Sentry.setExtra('context', context.extra);
      }

      // Set request ID if available
      if (context?.requestId) {
        Sentry.setTag('requestId', context.requestId);
      }

      // Capture exception
      if (error instanceof AppError) {
        // Operational errors - log with level based on status code
        if (error.statusCode >= 500) {
          Sentry.captureException(error, {
            level: 'error',
            tags: {
              errorType: 'operational',
              statusCode: error.statusCode.toString(),
            },
          });
        } else {
          // Client errors - log as warning
          Sentry.captureException(error, {
            level: 'warning',
            tags: {
              errorType: 'operational',
              statusCode: error.statusCode.toString(),
            },
          });
        }
      } else if (error instanceof Error) {
        // Unexpected errors - always log as error
        Sentry.captureException(error, {
          level: 'error',
          tags: {
            errorType: 'unexpected',
          },
        });
      } else {
        // Unknown error type
        Sentry.captureMessage('Unknown error occurred', {
          level: 'error',
          extra: {
            error,
            errorResponse,
          },
        });
      }
    } catch (sentryError) {
      // Don't fail if Sentry fails
      console.error('[ErrorHandler] Failed to send error to Sentry:', sentryError);
    }
  }

  // Log error using existing logger
  logError(error, context);

  return errorResponse;
}

/**
 * Track performance issue
 */
export function trackPerformanceIssue(
  message: string,
  duration: number,
  threshold: number,
  context?: {
    userId?: string;
    path?: string;
    tags?: Record<string, string>;
  }
): void {
  if (duration > threshold && process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.captureMessage(message, {
      level: 'warning',
      tags: {
        type: 'performance',
        duration: duration.toString(),
        threshold: threshold.toString(),
        ...context?.tags,
      },
      extra: {
        duration,
        threshold,
        path: context?.path,
      },
    });
  }
}

