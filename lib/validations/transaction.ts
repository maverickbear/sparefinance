import { z } from "zod";

// Recurring frequency options
export const recurringFrequencyEnum = z.enum([
  "daily",
  "weekly",
  "biweekly",
  "monthly",
  "semimonthly",
  "quarterly",
  "semiannual",
  "annual",
]);

export type RecurringFrequency = z.infer<typeof recurringFrequencyEnum>;

// Base schema object (without refinements)
const transactionSchemaBase = z.object({
  date: z.date(),
  type: z.enum(["expense", "income", "transfer"]),
  amount: z.number().positive("Amount must be positive"),
  accountId: z.string().min(1, "Account is required"),
  toAccountId: z.string().optional(), // For transfer transactions (outgoing)
  transferFromId: z.string().optional(), // For transfer transactions (incoming, e.g., credit card payments)
  categoryId: z.string().optional(),
  subcategoryId: z.string().optional(),
  description: z.string().optional(),
  recurring: z.boolean().default(false),
  recurringFrequency: recurringFrequencyEnum.optional(), // Only required when recurring is true
  expenseType: z.union([z.enum(["fixed", "variable"]), z.null()]).optional().transform((val) => val === null ? undefined : val), // Only for expense transactions, transform null to undefined
});

// Full schema with refinements for creating transactions
export const transactionSchema = transactionSchemaBase.refine((data) => {
  // If type is transfer, either toAccountId (outgoing) or transferFromId (incoming) is required
  if (data.type === "transfer") {
    const hasToAccount = !!data.toAccountId && data.toAccountId !== data.accountId;
    const hasFromAccount = !!data.transferFromId && data.transferFromId !== data.accountId;
    return hasToAccount || hasFromAccount;
  }
  return true;
}, {
  message: "Transfer requires either a destination account (toAccountId) or source account (transferFromId)",
  path: ["toAccountId"],
}).refine((data) => {
  // expenseType should only be set if type is expense
  if (data.type !== "expense" && data.expenseType !== undefined && data.expenseType !== null) {
    return false;
  }
  return true;
}, {
  message: "expenseType can only be set for expense transactions",
  path: ["expenseType"],
}).refine((data) => {
  // If recurring is true, recurringFrequency is required
  if (data.recurring && !data.recurringFrequency) {
    return false;
  }
  return true;
}, {
  message: "Recurring frequency is required when recurring is enabled",
  path: ["recurringFrequency"],
});

export type TransactionFormData = z.infer<typeof transactionSchema>;

// Partial schema for updates (all fields optional except validation rules)
export const transactionUpdateSchema = transactionSchemaBase.partial().refine((data) => {
  // If type is transfer, validate either toAccountId or transferFromId
  if (data.type === "transfer") {
    const hasToAccount = data.toAccountId !== undefined && !!data.toAccountId && data.toAccountId !== data.accountId;
    const hasFromAccount = data.transferFromId !== undefined && !!data.transferFromId && data.transferFromId !== data.accountId;
    // Allow updates if either is valid, or if both are undefined (partial update)
    if (data.toAccountId !== undefined || data.transferFromId !== undefined) {
      return hasToAccount || hasFromAccount;
    }
  }
  return true;
}, {
  message: "Transfer requires either a destination account (toAccountId) or source account (transferFromId)",
  path: ["toAccountId"],
}).refine((data) => {
  // If amount is provided, it must be positive
  if (data.amount !== undefined) {
    return data.amount > 0;
  }
  return true;
}, {
  message: "Amount must be positive",
  path: ["amount"],
}).refine((data) => {
  // expenseType should only be set if type is expense (or if type is not provided, check if expenseType is set)
  if (data.expenseType !== undefined && data.expenseType !== null) {
    // If expenseType is provided, type must be expense
    if (data.type !== undefined && data.type !== "expense") {
      return false;
    }
  }
  return true;
}, {
  message: "expenseType can only be set for expense transactions",
  path: ["expenseType"],
});

