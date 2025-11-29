/**
 * Domain types for profile
 * Pure TypeScript types with no external dependencies
 */

export interface BaseProfile {
  name: string;
  email: string;
  avatarUrl?: string | null;
  phoneNumber?: string | null;
}

