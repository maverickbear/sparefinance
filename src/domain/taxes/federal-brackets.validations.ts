/**
 * Domain validations for federal tax brackets
 */

import { z } from "zod";

export const federalBracketSchema = z.object({
  id: z.string().uuid(),
  countryCode: z.enum(["US", "CA"]),
  taxYear: z.number().int().min(2000).max(2100),
  bracketOrder: z.number().int().min(1),
  minIncome: z.number().min(0),
  maxIncome: z.number().nullable(),
  taxRate: z.number().min(0).max(1),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createFederalBracketSchema = z.object({
  countryCode: z.enum(["US", "CA"]),
  taxYear: z.number().int().min(2000).max(2100),
  bracketOrder: z.number().int().min(1),
  minIncome: z.number().min(0),
  maxIncome: z.number().nullable().optional(),
  taxRate: z.number().min(0).max(1),
  isActive: z.boolean().optional().default(true),
});

export const updateFederalBracketSchema = z.object({
  minIncome: z.number().min(0).optional(),
  maxIncome: z.number().nullable().optional(),
  taxRate: z.number().min(0).max(1).optional(),
  isActive: z.boolean().optional(),
});

export type FederalBracketFormData = z.infer<typeof federalBracketSchema>;
export type CreateFederalBracketFormData = z.infer<typeof createFederalBracketSchema>;
export type UpdateFederalBracketFormData = z.infer<typeof updateFederalBracketSchema>;

