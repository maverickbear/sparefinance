/**
 * Domain types for authentication
 * Pure TypeScript types with no external dependencies
 */

export interface BaseUser {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  phoneNumber?: string | null;
  role?: "admin" | "member" | "super_admin";
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface AuthResult {
  user: BaseUser | null;
  error: string | null;
  requiresEmailConfirmation?: boolean;
}

