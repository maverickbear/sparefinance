/**
 * Mock Auth Repository
 * Used for unit testing AuthService
 */

import { UserRow } from "@/src/infrastructure/database/repositories/auth.repository";

export interface MockAuthRepository {
  findById: jest.Mock;
  createUser: jest.Mock;
  updateUser: jest.Mock;
  findPendingInvitation: jest.Mock;
}

export function createMockAuthRepository(): MockAuthRepository {
  return {
    findById: jest.fn(),
    createUser: jest.fn(),
    updateUser: jest.fn(),
    findPendingInvitation: jest.fn(),
  };
}

export const mockUserRow: UserRow = {
  id: "test-user-id",
  email: "test@example.com",
  name: "Test User",
  avatar_url: null,
  phone_number: null,
  role: "admin",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

