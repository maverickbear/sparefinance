/**
 * Security logging utilities
 * Logs security-related events for monitoring and auditing
 */

export enum SecurityEventType {
  UNAUTHORIZED_ACCESS = "UNAUTHORIZED_ACCESS",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  INVALID_FILE_UPLOAD = "INVALID_FILE_UPLOAD",
  SUSPICIOUS_ACTIVITY = "SUSPICIOUS_ACTIVITY",
  AUTHENTICATION_FAILURE = "AUTHENTICATION_FAILURE",
  AUTHORIZATION_FAILURE = "AUTHORIZATION_FAILURE",
  IDOR_ATTEMPT = "IDOR_ATTEMPT",
  SQL_INJECTION_ATTEMPT = "SQL_INJECTION_ATTEMPT",
  XSS_ATTEMPT = "XSS_ATTEMPT",
  CSRF_ATTEMPT = "CSRF_ATTEMPT",
}

export interface SecurityLogEntry {
  type: SecurityEventType;
  message: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  resourceId?: string;
  resourceType?: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Log security event
 */
export function logSecurityEvent(
  type: SecurityEventType,
  message: string,
  options?: {
    userId?: string;
    ip?: string;
    userAgent?: string;
    resourceId?: string;
    resourceType?: string;
    details?: Record<string, unknown>;
  }
): void {
  const entry: SecurityLogEntry = {
    type,
    message,
    userId: options?.userId,
    ip: options?.ip,
    userAgent: options?.userAgent,
    resourceId: options?.resourceId,
    resourceType: options?.resourceType,
    details: options?.details,
    timestamp: new Date(),
  };

  // Log to console with structured format
  const logMessage = `[SECURITY] ${type}: ${message}`;
  const logData = {
    type,
    message,
    userId: entry.userId,
    ip: entry.ip,
    resourceId: entry.resourceId,
    resourceType: entry.resourceType,
    timestamp: entry.timestamp.toISOString(),
    ...entry.details,
  };

  // Use appropriate log level
  switch (type) {
    case SecurityEventType.UNAUTHORIZED_ACCESS:
    case SecurityEventType.IDOR_ATTEMPT:
    case SecurityEventType.SQL_INJECTION_ATTEMPT:
    case SecurityEventType.XSS_ATTEMPT:
    case SecurityEventType.CSRF_ATTEMPT:
      console.error(logMessage, logData);
      break;
    case SecurityEventType.RATE_LIMIT_EXCEEDED:
    case SecurityEventType.INVALID_FILE_UPLOAD:
    case SecurityEventType.AUTHENTICATION_FAILURE:
    case SecurityEventType.AUTHORIZATION_FAILURE:
      console.warn(logMessage, logData);
      break;
    default:
      console.warn(logMessage, logData);
  }

  // In production, you might want to send this to a logging service
  // e.g., Sentry, LogRocket, CloudWatch, etc.
  if (process.env.NODE_ENV === "production") {
    // TODO: Send to external logging service
    // Example: await sendToLoggingService(entry);
  }
}

/**
 * Helper functions for common security events
 */
export const SecurityLogger = {
  unauthorizedAccess: (
    message: string,
    options?: {
      userId?: string;
      ip?: string;
      userAgent?: string;
      resourceId?: string;
      resourceType?: string;
    }
  ) => {
    logSecurityEvent(SecurityEventType.UNAUTHORIZED_ACCESS, message, options);
  },

  rateLimitExceeded: (
    message: string,
    options?: {
      userId?: string;
      ip?: string;
      userAgent?: string;
    }
  ) => {
    logSecurityEvent(SecurityEventType.RATE_LIMIT_EXCEEDED, message, options);
  },

  invalidFileUpload: (
    message: string,
    options?: {
      userId?: string;
      ip?: string;
      userAgent?: string;
      details?: Record<string, unknown>;
    }
  ) => {
    logSecurityEvent(SecurityEventType.INVALID_FILE_UPLOAD, message, options);
  },

  idorAttempt: (
    message: string,
    options?: {
      userId?: string;
      ip?: string;
      userAgent?: string;
      resourceId?: string;
      resourceType?: string;
    }
  ) => {
    logSecurityEvent(SecurityEventType.IDOR_ATTEMPT, message, options);
  },

  authenticationFailure: (
    message: string,
    options?: {
      userId?: string;
      ip?: string;
      userAgent?: string;
    }
  ) => {
    logSecurityEvent(SecurityEventType.AUTHENTICATION_FAILURE, message, options);
  },

  authorizationFailure: (
    message: string,
    options?: {
      userId?: string;
      ip?: string;
      userAgent?: string;
      resourceId?: string;
      resourceType?: string;
    }
  ) => {
    logSecurityEvent(SecurityEventType.AUTHORIZATION_FAILURE, message, options);
  },
};

