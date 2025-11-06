import { z } from "zod";

export const signUpSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .refine(
      (password) => {
        // Basic password strength checks
        // Note: Supabase Auth's leaked password protection will check against HIBP
        // This is just basic validation
        return password.length >= 8;
      },
      {
        message: "Password must be at least 8 characters long",
      }
    ),
  name: z.string().min(1, "Name is required").optional(),
});

export const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type SignUpFormData = z.infer<typeof signUpSchema>;
export type SignInFormData = z.infer<typeof signInSchema>;

