/**
 * Feature Flags
 * Centralized feature flag configuration
 * 
 * SIMPLIFIED: Feature flags to control advanced/experimental features
 */

/**
 * Feature flag: Enable Receipts AI extraction
 * When false, receipts can only be uploaded (no AI extraction)
 */
export const ENABLE_RECEIPTS_AI = process.env.ENABLE_RECEIPTS_AI === 'true';

/**
 * Feature flag: Enable Advanced Investments features
 * When false, only core investment features are available
 */
export const ENABLE_INVESTMENTS_ADVANCED = process.env.ENABLE_INVESTMENTS_ADVANCED === 'true';

/**
 * Feature flag: Enable Advanced Reports
 * When false, only core reports are available
 */
export const ENABLE_ADVANCED_REPORTS = process.env.ENABLE_ADVANCED_REPORTS === 'true';

/**
 * Feature flag: Enable Advanced Import Jobs
 * When false, imports are synchronous for small files
 */
export const ENABLE_ADVANCED_IMPORTS = process.env.ENABLE_ADVANCED_IMPORTS === 'true';
