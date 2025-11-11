import { z } from "zod";

export const transactionSchema = z.object({
  date: z.date(),
  type: z.enum(["expense", "income", "transfer"]),
  amount: z.number().positive("Amount must be positive"),
  accountId: z.string().min(1, "Account is required"),
  toAccountId: z.string().optional(), // For transfer transactions
  categoryId: z.string().optional(),
  subcategoryId: z.string().optional(),
  description: z.string().optional(),
  recurring: z.boolean().default(false),
}).refine((data) => {
  // If type is transfer, toAccountId is required
  if (data.type === "transfer") {
    return !!data.toAccountId && data.toAccountId !== data.accountId;
  }
  return true;
}, {
  message: "Transfer requires a different destination account",
  path: ["toAccountId"],
});

export type TransactionFormData = z.infer<typeof transactionSchema>;

