/**
 * Structured Logger
 * Provides structured logging with correlation IDs, sanitization, and consistent formatting
 */

const isDevelopment = 
  typeof process !== "undefined" 
    ? process.env.NODE_ENV === "development"
    : typeof window !== "undefined" && window.location.hostname === "localhost";

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  correlationId?: string;
  userId?: string;
  [key: string]: unknown;
}

/**
 * Fields that should be redacted from logs
 */
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'apiKey',
  'secret',
  'authorization',
  'cookie',
  'email',
  'phoneNumber',
  'creditCard',
  'cvv',
  'ssn',
  'socialSecurityNumber',
];

/**
 * Redact sensitive fields from an object
 */
function redactSensitiveFields(obj: unknown, depth = 0): unknown {
  if (depth > 10) return '[Max depth reached]'; // Prevent infinite recursion
  
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    // Check if string looks like a token/secret
    if (obj.length > 20 && /^[A-Za-z0-9_-]+$/.test(obj)) {
      return '[REDACTED]';
    }
    return obj;
  }
  
  if (typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitiveFields(item, depth + 1));
  }
  
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    const shouldRedact = SENSITIVE_FIELDS.some(field => lowerKey.includes(field.toLowerCase()));
    
    if (shouldRedact) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSensitiveFields(value, depth + 1);
    } else {
      redacted[key] = value;
    }
  }
  
  return redacted;
}

/**
 * Format log entry as structured JSON
 */
function formatLogEntry(
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: Error
): string {
  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (context) {
    entry.correlationId = context.correlationId;
    entry.userId = context.userId;
    
    // Add other context fields (redacted)
    const { correlationId, userId, ...otherContext } = context;
    if (Object.keys(otherContext).length > 0) {
      entry.context = redactSensitiveFields(otherContext);
    }
  }

  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: isDevelopment ? error.stack : undefined,
    };
  }

  return JSON.stringify(entry);
}

/**
 * Get correlation ID from context (if available)
 */
function getCorrelationId(): string | undefined {
  if (typeof process !== 'undefined') {
    // Try to get from AsyncLocalStorage or similar (if implemented)
    // For now, we'll use a simple approach
    return undefined;
  }
  return undefined;
}

/**
 * Structured Logger
 */
export const structuredLogger = {
  /**
   * Log debug message
   */
  debug(message: string, context?: LogContext): void {
    if (isDevelopment) {
      const correlationId = context?.correlationId || getCorrelationId();
      const formatted = formatLogEntry('debug', message, { ...context, correlationId });
      console.debug(formatted);
    }
  },

  /**
   * Log info message
   */
  info(message: string, context?: LogContext): void {
    const correlationId = context?.correlationId || getCorrelationId();
    const formatted = formatLogEntry('info', message, { ...context, correlationId });
    if (isDevelopment) {
      console.info(formatted);
    } else {
      // In production, only log important info
      console.log(formatted);
    }
  },

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext, error?: Error): void {
    const correlationId = context?.correlationId || getCorrelationId();
    const formatted = formatLogEntry('warn', message, { ...context, correlationId }, error);
    console.warn(formatted);
  },

  /**
   * Log error message
   */
  error(message: string, context?: LogContext, error?: Error): void {
    const correlationId = context?.correlationId || getCorrelationId();
    const formatted = formatLogEntry('error', message, { ...context, correlationId }, error);
    console.error(formatted);
  },

  /**
   * Create a child logger with default context
   */
  child(defaultContext: LogContext) {
    return {
      debug: (message: string, context?: LogContext) => 
        structuredLogger.debug(message, { ...defaultContext, ...context }),
      info: (message: string, context?: LogContext) => 
        structuredLogger.info(message, { ...defaultContext, ...context }),
      warn: (message: string, context?: LogContext, error?: Error) => 
        structuredLogger.warn(message, { ...defaultContext, ...context }, error),
      error: (message: string, context?: LogContext, error?: Error) => 
        structuredLogger.error(message, { ...defaultContext, ...context }, error),
    };
  },
};

/**
 * Generate a correlation ID
 */
export function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

