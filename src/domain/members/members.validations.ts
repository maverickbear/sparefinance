import { z } from "zod";

export const memberInviteSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().optional(),
  role: z.enum(["admin", "member"]).optional().default("member"),
});

export type MemberInviteFormData = z.infer<typeof memberInviteSchema>;

export const memberUpdateSchema = z.object({
  name: z.string().optional(),
  email: z.string().email("Invalid email address").optional(),
  role: z.enum(["admin", "member"]).optional(),
});

export type MemberUpdateFormData = z.infer<typeof memberUpdateSchema>;

