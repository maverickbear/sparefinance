import { z } from "zod";

export const budgetSchema = z.object({
  period: z.date(),
  categoryId: z.string().optional(),
  subcategoryId: z.string().optional(),
  amount: z.number().positive("Amount must be positive"),
}).refine(
  (data) => {
    return !!data.categoryId;
  },
  {
    message: "Category must be selected",
    path: ["categoryId"],
  }
);

export type BudgetFormData = z.infer<typeof budgetSchema>;

