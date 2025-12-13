/**
 * Domain Constants
 * Centralized constants used across the application
 * Avoids magic numbers and improves maintainability
 */

// Password validation
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

// Emergency Fund
export const EMERGENCY_FUND_DEFAULT_AMOUNT = 1000.00; // Default target until calculated
export const EMERGENCY_FUND_MONTHS = 6; // Recommended months of expenses

// Household
export const HOUSEHOLD_DEFAULT_NAME = "Minha Conta";

// Transaction Import
// SIMPLIFIED: Increased threshold so most imports are synchronous (simpler, faster)
export const TRANSACTION_IMPORT_THRESHOLD = 1000; // Use background job for imports >= this number (was 20)
export const TRANSACTION_IMPORT_BATCH_SIZE = 20; // Process transactions in batches of this size
export const TRANSACTION_IMPORT_BATCH_DELAY_MS = 100; // Delay between batches (ms)
export const TRANSACTION_IMPORT_PROGRESS_INTERVAL = 100; // Update progress every N transactions (approximate)

// Progress Tracking
export const PROGRESS_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
export const PROGRESS_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

// Rate Limiting
export const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
export const RATE_LIMIT_MAX_REQUESTS = 100; // Max requests per window

// Health Checks
export const HEALTH_CHECK_TIMEOUT_MS = 5000; // 5 seconds

// Metrics
export const METRICS_FLUSH_INTERVAL_MS = 60000; // 1 minute
export const METRICS_MAX_BATCH_SIZE = 100;

