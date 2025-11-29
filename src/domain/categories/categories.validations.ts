import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  groupId: z.string().min(1, "Group is required"),
  // Deprecated: Use groupId instead
  macroId: z.string().min(1, "Group is required").optional(),
}).refine(
  (data) => data.groupId || data.macroId,
  {
    message: "Group is required",
    path: ["groupId"],
  }
);

export type CategoryFormData = z.infer<typeof categorySchema>;

export const subcategorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  categoryId: z.string().min(1, "Category is required"),
  logo: z.string().url().optional().nullable().or(z.literal("")),
});

export type SubcategoryFormData = z.infer<typeof subcategorySchema>;

export const groupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["income", "expense"]).nullable().optional(),
});

export type GroupFormData = z.infer<typeof groupSchema>;

