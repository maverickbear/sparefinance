/**
 * Sentry Server Configuration
 * Error tracking for server-side errors
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Set sample rate for profiling
  profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  environment: process.env.NODE_ENV || 'development',
  
  // Filter out sensitive data
  beforeSend(event, hint) {
    // Remove sensitive data from request
    if (event.request) {
      // Remove cookies
      if (event.request.cookies) {
        delete event.request.cookies;
      }
      
      // Remove sensitive headers
      if (event.request.headers) {
        const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-forwarded-for'];
        sensitiveHeaders.forEach(header => {
          if (event.request?.headers?.[header]) {
            delete event.request.headers[header];
          }
        });
      }
    }

    // Remove sensitive data from user context
    if (event.user) {
      // Keep only necessary user info
      event.user = {
        id: event.user.id,
        email: event.user.email ? event.user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : undefined,
      };
    }

    // Remove sensitive data from extra context
    if (event.extra) {
      const sensitiveKeys = ['password', 'token', 'secret', 'key', 'accessToken', 'refreshToken'];
      sensitiveKeys.forEach(key => {
        if (event.extra?.[key]) {
          event.extra[key] = '[REDACTED]';
        }
      });
    }

    return event;
  },

  // Ignore certain errors
  ignoreErrors: [
    // Database connection errors (handled separately)
    'ECONNREFUSED',
    'ETIMEDOUT',
    // Rate limiting (expected behavior)
    'Too many requests',
    // Validation errors (expected)
    'ValidationError',
  ],

  // Filter out certain transactions
  beforeSendTransaction(event) {
    // Don't track health check endpoints
    if (event.transaction?.includes('/api/health')) {
      return null;
    }
    return event;
  },
});

