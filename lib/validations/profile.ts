import { z } from "zod";

export const profileSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  email: z.string().email("Invalid email address"),
  avatarUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
  phoneNumber: z.string().optional().or(z.literal("")),
});

export type ProfileFormData = z.infer<typeof profileSchema>;

