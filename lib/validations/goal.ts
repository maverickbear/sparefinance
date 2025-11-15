import { z } from "zod";

export const goalSchema = z.object({
  name: z.string().min(1, "Name is required"),
  targetAmount: z.number().positive("Target amount must be positive"),
  currentBalance: z.number().nonnegative("Current balance must be non-negative").optional().default(0),
  incomePercentage: z.number().min(0, "Income percentage must be at least 0").max(100, "Income percentage cannot exceed 100%").optional(),
  priority: z.enum(["High", "Medium", "Low"], {
    errorMap: () => ({ message: "Priority must be High, Medium, or Low" }),
  }),
  description: z.string().optional(),
  expectedIncome: z.number().positive("Expected income must be positive").optional(),
  targetMonths: z.number().positive("Target months must be positive"),
  accountId: z.string().optional(),
  holdingId: z.string().optional(),
});

export type GoalFormData = z.infer<typeof goalSchema>;

