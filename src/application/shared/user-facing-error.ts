/**
 * User-Facing Error
 * Provides user-friendly error messages while preserving technical details for logging
 */

export class UserFacingError extends Error {
  public readonly userMessage: string;
  public readonly technicalMessage: string;
  public readonly code?: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean = true;

  constructor(
    userMessage: string,
    technicalMessage?: string,
    options?: {
      code?: string;
      statusCode?: number;
      cause?: Error;
    }
  ) {
    super(technicalMessage || userMessage);
    this.name = 'UserFacingError';
    this.userMessage = userMessage;
    this.technicalMessage = technicalMessage || userMessage;
    this.code = options?.code;
    this.statusCode = options?.statusCode || 500;
    
    if (options?.cause) {
      this.cause = options.cause;
    }
  }

  /**
   * Create a UserFacingError from a technical error
   */
  static fromError(error: unknown, userMessage?: string): UserFacingError {
    if (error instanceof UserFacingError) {
      return error;
    }

    if (error instanceof Error) {
      return new UserFacingError(
        userMessage || "An unexpected error occurred. Please try again later.",
        error.message,
        {
          cause: error,
        }
      );
    }

    return new UserFacingError(
      userMessage || "An unexpected error occurred. Please try again later.",
      String(error)
    );
  }

  /**
   * Map common error types to user-friendly messages
   */
  static mapToUserMessage(error: unknown): string {
    if (error instanceof UserFacingError) {
      return error.userMessage;
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      // Database errors
      if (message.includes('unique constraint') || message.includes('duplicate key')) {
        return "This record already exists. Please check your input and try again.";
      }
      
      if (message.includes('foreign key constraint')) {
        return "Invalid reference. Please check your input and try again.";
      }
      
      if (message.includes('not null constraint')) {
        return "Required field is missing. Please fill in all required fields.";
      }
      
      // Authentication errors
      if (message.includes('invalid credentials') || message.includes('wrong password')) {
        return "Invalid email or password. Please check your credentials and try again.";
      }
      
      if (message.includes('email already exists') || message.includes('user already exists')) {
        return "An account with this email already exists. Please sign in instead.";
      }
      
      if (message.includes('email not verified') || message.includes('email verification')) {
        return "Please verify your email address before continuing.";
      }
      
      // Network errors
      if (message.includes('network') || message.includes('fetch')) {
        return "Network error. Please check your connection and try again.";
      }
      
      if (message.includes('timeout')) {
        return "Request timed out. Please try again.";
      }
      
      // Rate limiting
      if (message.includes('rate limit') || message.includes('too many requests')) {
        return "Too many requests. Please wait a moment and try again.";
      }
      
      // Generic fallback
      return "An error occurred. Please try again later.";
    }

    return "An unexpected error occurred. Please try again later.";
  }
}

