import { z } from "zod";

export const plannedPaymentSchema = z.object({
  date: z.union([z.date(), z.string()]),
  type: z.enum(["expense", "income", "transfer"]),
  amount: z.number().positive("Amount must be positive"),
  accountId: z.string().uuid("Invalid account ID"),
  toAccountId: z.string().uuid().optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  subcategoryId: z.string().uuid().optional().nullable(),
  description: z.string().optional().nullable(),
  source: z.enum(["recurring", "debt", "manual", "subscription"]).optional(),
  debtId: z.string().uuid().optional().nullable(),
  subscriptionId: z.string().uuid().optional().nullable(),
});

export type PlannedPaymentFormData = z.infer<typeof plannedPaymentSchema>;

