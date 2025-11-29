/**
 * Domain types for members
 * Pure TypeScript types with no external dependencies
 */

export interface BaseHouseholdMember {
  id: string;
  ownerId: string;
  memberId: string | null;
  email: string;
  name: string | null;
  role: "admin" | "member";
  status: "pending" | "active" | "declined";
  invitationToken: string;
  invitedAt: Date | string;
  acceptedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  isOwner?: boolean;
  avatarUrl?: string | null;
}

export interface UserHouseholdInfo {
  isOwner: boolean;
  isMember: boolean;
  ownerId?: string;
  ownerName?: string;
}

// Alias for backward compatibility (matches client-side HouseholdMember interface)
export interface HouseholdMember {
  id: string;
  memberId: string | null;
  email: string;
  name: string | null;
  role: "admin" | "member";
  status: "pending" | "active" | "declined";
  isOwner: boolean;
  avatarUrl?: string | null;
  createdAt?: Date | string;
  invitedAt?: Date | string;
  acceptedAt?: Date | string | null;
}

