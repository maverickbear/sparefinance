import { z } from "zod";

export const accountSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["cash", "checking", "savings", "credit", "investment", "other"]),
  creditLimit: z.number().positive("Credit limit must be positive").optional().nullable(),
  initialBalance: z.number().optional().nullable(),
  ownerIds: z.array(z.string().uuid()).optional(),
}).refine((data) => {
  // Credit limit is required for credit cards, optional for others
  if (data.type === "credit" && !data.creditLimit) {
    return false;
  }
  return true;
}, {
  message: "Credit limit is required for credit cards",
  path: ["creditLimit"],
});

export type AccountFormData = z.infer<typeof accountSchema>;

