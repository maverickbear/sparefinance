import { z } from "zod";

// Helper to create optional nullable UUID field that accepts empty strings
const optionalUuidField = () =>
  z
    .union([z.string().uuid(), z.literal(""), z.null(), z.undefined()])
    .optional()
    .transform((val) => (val === "" ? null : val));

// Helper to accept non-empty string IDs (legacy or UUID), optional and nullable
const optionalIdField = () =>
  z
    .union([z.string().min(1), z.literal(""), z.null(), z.undefined()])
    .optional()
    .transform((val) => (val === "" ? null : val));

export const financialEventSchema = z.object({
  date: z.union([z.date(), z.string()]),
  type: z.enum(["expense", "income", "transfer"]),
  amount: z.number().positive("Amount must be positive"),
  accountId: z.string().uuid("Invalid account ID"),
  toAccountId: optionalUuidField(),
  categoryId: optionalIdField(),
  subcategoryId: optionalIdField(),
  description: z.string().optional().nullable(),
  source: z.enum(["recurring", "debt", "manual", "subscription", "goal"]).optional(),
  debtId: optionalUuidField(),
  subscriptionId: optionalUuidField(),
  goalId: optionalUuidField(),
});

export type FinancialEventFormData = z.infer<typeof financialEventSchema>;

// Backward compatibility: export old name
export const plannedPaymentSchema = financialEventSchema;
export type PlannedPaymentFormData = FinancialEventFormData;
