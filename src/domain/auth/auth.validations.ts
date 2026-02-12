import { z } from "zod";

/**
 * Password validation helper
 * Validates password complexity: 12+ characters, uppercase, lowercase, number, special character
 */
export const passwordValidation = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .refine(
    (password) => {
      // Check length
      if (password.length < 12) return false;
      // Check for uppercase letter
      if (!/[A-Z]/.test(password)) return false;
      // Check for lowercase letter
      if (!/[a-z]/.test(password)) return false;
      // Check for number
      if (!/[0-9]/.test(password)) return false;
      // Check for special character
      if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return false;
      return true;
    },
    {
      message: "Password must be at least 12 characters and include uppercase, lowercase, number, and special character",
    }
  );

export const signUpSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: passwordValidation,
  name: z.string().min(1, "Name is required"),
  turnstileToken: z.string().optional(),
});

export type SignUpFormData = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  turnstileToken: z.string().optional(),
});

export type SignInFormData = z.infer<typeof signInSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: passwordValidation,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordValidation,
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
  });

export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

