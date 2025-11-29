/**
 * Plan Features Service
 * 
 * Centralized service for managing and validating plan features.
 * This ensures type safety, validation, and consistent feature access throughout the app.
 */

import { planFeaturesSchema, type PlanFeatures } from "@/src/domain/subscriptions/subscriptions.validations";
import { getDefaultFeatures } from "@/lib/utils/plan-features";
import { logger } from "@/src/infrastructure/utils/logger";

const log = logger.withPrefix("PLAN-FEATURES-SERVICE");

/**
 * Normalize features from database (handles JSONB string/object conversion)
 * and validate against schema
 */
export function normalizeAndValidateFeatures(
  rawFeatures: unknown,
  planId?: string
): PlanFeatures {
  let parsedFeatures: unknown;

  // Handle JSONB from Supabase (can be string or object)
  if (typeof rawFeatures === 'string') {
    try {
      parsedFeatures = JSON.parse(rawFeatures);
    } catch (error) {
      log.warn("Error parsing plan features as JSON string:", { 
        planId, 
        error: error instanceof Error ? error.message : String(error),
        rawFeatures 
      });
      return getDefaultFeatures();
    }
  } else if (rawFeatures && typeof rawFeatures === 'object') {
    parsedFeatures = rawFeatures;
  } else {
    log.warn("Plan features missing or invalid type:", { 
      planId, 
      type: typeof rawFeatures 
    });
    return getDefaultFeatures();
  }

  // Merge with defaults first to ensure all fields are present
  // This handles cases where new features are added to the schema but don't exist in the database yet
  const defaults = getDefaultFeatures();
  const mergedFeatures = { ...defaults, ...(parsedFeatures && typeof parsedFeatures === 'object' ? parsedFeatures : {}) };

  // Validate against schema
  const validationResult = planFeaturesSchema.safeParse(mergedFeatures);
  
  if (!validationResult.success) {
    // Format validation errors for better logging
    const errorMessages = validationResult.error.errors.map(err => ({
      path: err.path.join('.'),
      message: err.message,
      code: err.code,
    }));
    
    log.error(
      `Plan features validation failed for plan ${planId || 'unknown'}:`,
      `Errors: ${JSON.stringify(errorMessages, null, 2)}`,
      `Raw features: ${JSON.stringify(parsedFeatures, null, 2)}`,
      `Merged features: ${JSON.stringify(mergedFeatures, null, 2)}`
    );
    return getDefaultFeatures();
  }

  // Normalize boolean values (handle string "true"/"false" from JSONB)
  const normalized: PlanFeatures = {
    ...validationResult.data,
    // Ensure all boolean features are actual booleans
    hasInvestments: normalizeBoolean(validationResult.data.hasInvestments),
    hasAdvancedReports: normalizeBoolean(validationResult.data.hasAdvancedReports),
    hasCsvExport: normalizeBoolean(validationResult.data.hasCsvExport),
    hasCsvImport: normalizeBoolean(validationResult.data.hasCsvImport),
    hasDebts: normalizeBoolean(validationResult.data.hasDebts),
    hasGoals: normalizeBoolean(validationResult.data.hasGoals),
    hasBankIntegration: normalizeBoolean(validationResult.data.hasBankIntegration),
    hasHousehold: normalizeBoolean(validationResult.data.hasHousehold),
    hasBudgets: normalizeBoolean(validationResult.data.hasBudgets),
    // Ensure numeric limits are numbers
    maxTransactions: Number(validationResult.data.maxTransactions),
    maxAccounts: Number(validationResult.data.maxAccounts),
  };

  return normalized;
}

/**
 * Normalize a value to boolean
 * Handles: true, false, "true", "false", 1, 0
 */
function normalizeBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  return false;
}

/**
 * Check if a feature is enabled for a plan
 * Returns true if feature is enabled, false otherwise
 */
export function hasFeature(
  features: PlanFeatures,
  feature: keyof PlanFeatures
): boolean {
  const value = features[feature];
  
  // For boolean features
  if (typeof value === 'boolean') {
    return value;
  }
  
  // For numeric limits, -1 means unlimited (considered enabled)
  if (typeof value === 'number') {
    return value === -1 || value > 0;
  }
  
  return false;
}

/**
 * Check if a feature is enabled (with type safety)
 */
export function hasFeatureAccess(
  features: PlanFeatures | null | undefined,
  feature: keyof PlanFeatures
): boolean {
  if (!features) {
    return false;
  }
  return hasFeature(features, feature);
}

/**
 * Get feature value with type safety
 */
export function getFeatureValue<T extends keyof PlanFeatures>(
  features: PlanFeatures,
  feature: T
): PlanFeatures[T] {
  return features[feature];
}

/**
 * Validate features before saving to database
 * Returns validated features or throws error
 */
export function validateFeaturesForSave(
  features: unknown
): PlanFeatures {
  const validationResult = planFeaturesSchema.safeParse(features);
  
  if (!validationResult.success) {
    log.error("Feature validation failed:", {
      error: validationResult.error.errors,
      features,
    });
    throw new Error(
      `Invalid features: ${validationResult.error.errors.map(e => e.message).join(', ')}`
    );
  }
  
  return validationResult.data;
}

/**
 * Merge features with defaults (for backward compatibility)
 * Only merges missing fields, doesn't override existing values
 */
export function mergeFeaturesWithDefaults(
  dbFeatures: Partial<PlanFeatures>
): PlanFeatures {
  const defaults = getDefaultFeatures();
  return { ...defaults, ...dbFeatures };
}

