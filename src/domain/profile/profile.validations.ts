import { z } from "zod";

export const profileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  avatarUrl: z.string().url().optional().nullable().or(z.literal("")),
  phoneNumber: z.string().optional().nullable(),
});

export type ProfileFormData = z.infer<typeof profileSchema>;

