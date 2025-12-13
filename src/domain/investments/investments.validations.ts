import { z } from "zod";

export const investmentTransactionSchema = z.object({
  date: z.union([z.date(), z.string()]),
  accountId: z.string().uuid("Invalid account ID"),
  securityId: z.string().uuid().optional().nullable(),
  type: z.enum(["buy", "sell", "dividend", "interest", "transfer_in", "transfer_out"]),
  quantity: z.number().positive().optional().nullable(),
  price: z.number().positive().optional().nullable(),
  fees: z.number().min(0).optional().default(0),
  notes: z.string().optional().nullable(),
});

export type InvestmentTransactionFormData = z.infer<typeof investmentTransactionSchema>;

export const securityPriceSchema = z.object({
  securityId: z.string().uuid("Invalid security ID"),
  date: z.union([z.date(), z.string()]),
  price: z.number().positive("Price must be positive"),
});

export type SecurityPriceFormData = z.infer<typeof securityPriceSchema>;

export const investmentAccountSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

export type InvestmentAccountFormData = z.infer<typeof investmentAccountSchema>;

export const createSimpleInvestmentEntrySchema = z.object({
  accountId: z.string().min(1),
  date: z.string().or(z.date()),
  type: z.enum(["contribution", "dividend", "interest", "initial"]),
  amount: z.number().positive(),
  description: z.string().optional(),
});

export type CreateSimpleInvestmentEntryFormData = z.infer<typeof createSimpleInvestmentEntrySchema>;

export const updateAccountInvestmentValueSchema = z.object({
  totalValue: z.number().positive(),
});

export type UpdateAccountInvestmentValueFormData = z.infer<typeof updateAccountInvestmentValueSchema>;

export const createSecuritySchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
  name: z.string().min(1, "Name is required"),
  class: z.enum(["stock", "etf", "crypto", "bond", "reit"]),
});

export type CreateSecurityFormData = z.infer<typeof createSecuritySchema>;

// Investment Refresh System Validations

export const manualInvestmentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  currentValue: z.number().positive("Current value must be positive"),
  estimatedGrowth: z.number().min(-100).max(100).optional().nullable(),
});

export type ManualInvestmentFormData = z.infer<typeof manualInvestmentSchema>;

export const updateManualInvestmentSchema = z.object({
  title: z.string().min(1).optional(),
  currentValue: z.number().positive().optional(),
  estimatedGrowth: z.number().min(-100).max(100).optional().nullable(),
});

export type UpdateManualInvestmentFormData = z.infer<typeof updateManualInvestmentSchema>;

