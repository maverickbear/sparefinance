/**
 * Auth Repository Interface
 * Contract for authentication data access
 */

import { UserRow } from "../auth.repository";

export interface IAuthRepository {
  findById(userId: string): Promise<UserRow | null>;
  createUser(data: {
    id: string;
    email: string;
    name: string | null;
    role: string | null;
  }): Promise<UserRow>;
  updateUser(
    userId: string,
    data: Partial<{
      name: string | null;
      avatarUrl: string | null;
      phoneNumber: string | null;
    }>
  ): Promise<UserRow>;
  findPendingInvitation(email: string): Promise<{ id: string; householdId: string; createdBy: string } | null>;
  findByEmail(email: string): Promise<UserRow | null>;
  findUsersByDateRange(startDate: Date, endDate: Date): Promise<UserRow[]>;
}

