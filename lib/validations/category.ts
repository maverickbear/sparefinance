import { z } from "zod";

// NOTE: Groups have been completely removed. Categories now have a direct type property.
export const categorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["income", "expense"], {
    required_error: "Type is required",
    invalid_type_error: "Type must be either 'income' or 'expense'",
  }),
});

export type CategoryFormData = z.infer<typeof categorySchema>;

export const subcategorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  categoryId: z.string().min(1, "Category is required"),
  logo: z.string().url().optional().nullable().or(z.literal("")),
});

export type SubcategoryFormData = z.infer<typeof subcategorySchema>;

