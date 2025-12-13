import { z } from "zod";

export const budgetSchema = z.object({
  period: z.date(),
  categoryId: z.string().optional(),
  subcategoryId: z.string().optional(),
  amount: z.number().positive("Amount must be positive"),
  note: z.string().optional().nullable(),
  isRecurring: z.boolean().optional(),
}).refine(
  (data) => {
    // Either categoryId or subcategoryId must be provided
    return !!(data.categoryId || data.subcategoryId);
  },
  {
    message: "Category must be selected",
    path: ["categoryId"],
  }
);

export type BudgetFormData = z.infer<typeof budgetSchema>;

