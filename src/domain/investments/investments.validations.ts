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

