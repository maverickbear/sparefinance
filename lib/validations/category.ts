import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  macroId: z.string().min(1, "Group is required"),
});

export type CategoryFormData = z.infer<typeof categorySchema>;

export const subcategorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  categoryId: z.string().min(1, "Category is required"),
  logo: z.string().url().optional().nullable().or(z.literal("")),
});

export type SubcategoryFormData = z.infer<typeof subcategorySchema>;

