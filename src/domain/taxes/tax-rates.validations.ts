/**
 * Domain validations for tax rates management
 * Zod schemas for tax rate inputs
 */

import { z } from "zod";

export const taxRateSchema = z.object({
  id: z.string().uuid(),
  countryCode: z.enum(["US", "CA"]),
  stateOrProvinceCode: z.string().min(2).max(3),
  taxRate: z.number().min(0).max(1),
  displayName: z.string().min(1),
  description: z.string().nullable().optional(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createTaxRateSchema = z.object({
  countryCode: z.enum(["US", "CA"]),
  stateOrProvinceCode: z.string().min(2).max(3),
  taxRate: z.number().min(0).max(1),
  displayName: z.string().min(1),
  description: z.string().nullable().optional(),
  isActive: z.boolean().optional().default(true),
});

export const updateTaxRateSchema = z.object({
  taxRate: z.number().min(0).max(1).optional(),
  displayName: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export type TaxRateFormData = z.infer<typeof taxRateSchema>;
export type CreateTaxRateFormData = z.infer<typeof createTaxRateSchema>;
export type UpdateTaxRateFormData = z.infer<typeof updateTaxRateSchema>;

