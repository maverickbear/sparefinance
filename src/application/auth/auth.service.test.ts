/**
 * Auth Service Unit Tests
 * Tests for authentication business logic
 */

import { AuthService } from "./auth.service";
import { AuthRepository } from "@/src/infrastructure/database/repositories/auth.repository";
import { SignUpFormData } from "@/src/domain/auth/auth.validations";
import { createMockAuthRepository, mockUserRow } from "./__mocks__/auth.repository.mock";

// Mock Supabase client
jest.mock("@/src/infrastructure/database/supabase-server", () => ({
  createServerClient: jest.fn(() => ({
    auth: {
      signUp: jest.fn(),
      getUser: jest.fn(),
      signInWithPassword: jest.fn(),
      signInWithOAuth: jest.fn(),
      updateUser: jest.fn(),
    },
  })),
  createServiceRoleClient: jest.fn(() => ({
    rpc: jest.fn(),
  })),
}));

// Mock HIBP validation
jest.mock("@/lib/utils/hibp", () => ({
  validatePasswordAgainstHIBP: jest.fn(() => Promise.resolve({ isValid: true })),
}));

// Mock event bus
jest.mock("@/src/application/events/events.factory", () => ({
  getEventBus: jest.fn(() => ({
    publish: jest.fn(() => Promise.resolve()),
  })),
}));

describe("AuthService", () => {
  let authService: AuthService;
  let mockRepository: jest.Mocked<AuthRepository>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock repository
    mockRepository = {
      findById: jest.fn(),
      createUser: jest.fn(),
      updateUser: jest.fn(),
      findPendingInvitation: jest.fn(),
    } as any;

    // Create service instance
    authService = new AuthService(mockRepository);
  });

  describe("signUp", () => {
    const validSignUpData: SignUpFormData = {
      email: "test@example.com",
      password: "SecurePassword123!@#",
      name: "Test User",
    };

    it("should successfully sign up a new user", async () => {
      // Mock Supabase auth signup
      const { createServerClient } = require("@/src/infrastructure/database/supabase-server");
      const mockSupabase = createServerClient();
      mockSupabase.auth.signUp.mockResolvedValue({
        data: {
          user: {
            id: "test-user-id",
            email: "test@example.com",
          },
        },
        error: null,
      });

      // Mock repository
      mockRepository.findById.mockResolvedValue(null);
      mockRepository.createUser.mockResolvedValue(mockUserRow);
      mockRepository.findPendingInvitation.mockResolvedValue(null);

      // Mock event bus
      const { getEventBus } = require("@/src/application/events/events.factory");
      const mockEventBus = getEventBus();
      mockEventBus.publish.mockResolvedValue(undefined);

      // Mock household creation (via event)
      const { createServiceRoleClient } = require("@/src/infrastructure/database/supabase-server");
      const mockServiceClient = createServiceRoleClient();
      mockServiceClient.rpc.mockResolvedValue({
        data: "household-id",
        error: null,
      });

      // Execute
      const result = await authService.signUp(validSignUpData);

      // Assert
      expect(result.error).toBeNull();
      expect(result.user).toBeDefined();
      expect(result.user?.email).toBe(validSignUpData.email);
      expect(mockRepository.createUser).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it("should fail if password is invalid (HIBP)", async () => {
      // Mock HIBP validation failure
      const { validatePasswordAgainstHIBP } = require("@/lib/utils/hibp");
      validatePasswordAgainstHIBP.mockResolvedValue({
        isValid: false,
        error: "Password found in data breach",
      });

      // Execute
      const result = await authService.signUp(validSignUpData);

      // Assert
      expect(result.error).toBeDefined();
      expect(result.user).toBeNull();
      expect(mockRepository.createUser).not.toHaveBeenCalled();
    });

    it("should fail if email has pending invitation", async () => {
      // Mock pending invitation
      mockRepository.findPendingInvitation.mockResolvedValue({
        id: "invitation-id",
        householdId: "household-id",
        createdBy: "user-id",
      });

      // Execute
      const result = await authService.signUp(validSignUpData);

      // Assert
      expect(result.error).toBeDefined();
      expect(result.error).toContain("pending invitation");
      expect(result.user).toBeNull();
    });

    it("should fail if Supabase signup fails", async () => {
      // Mock Supabase auth signup failure
      const { createServerClient } = require("@/src/infrastructure/database/supabase-server");
      const mockSupabase = createServerClient();
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: null },
        error: { message: "Email already exists" },
      });

      mockRepository.findPendingInvitation.mockResolvedValue(null);

      // Execute
      const result = await authService.signUp(validSignUpData);

      // Assert
      expect(result.error).toBeDefined();
      expect(result.user).toBeNull();
    });
  });

  describe("signIn", () => {
    const validSignInData = {
      email: "test@example.com",
      password: "SecurePassword123!@#",
    };

    it("should successfully sign in a user", async () => {
      // Mock Supabase auth signin
      const { createServerClient } = require("@/src/infrastructure/database/supabase-server");
      const mockSupabase = createServerClient();
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: {
            id: "test-user-id",
            email: "test@example.com",
          },
          session: {
            access_token: "access-token",
            refresh_token: "refresh-token",
          },
        },
        error: null,
      });

      // Mock repository
      mockRepository.findById.mockResolvedValue(mockUserRow);

      // Execute
      const result = await authService.signIn(validSignInData);

      // Assert
      expect(result.error).toBeNull();
      expect(result.user).toBeDefined();
      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: validSignInData.email,
        password: validSignInData.password,
      });
    });

    it("should fail with invalid credentials", async () => {
      // Mock Supabase auth signin failure
      const { createServerClient } = require("@/src/infrastructure/database/supabase-server");
      const mockSupabase = createServerClient();
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: "Invalid credentials" },
      });

      // Execute
      const result = await authService.signIn(validSignInData);

      // Assert
      expect(result.error).toBeDefined();
      expect(result.user).toBeNull();
    });
  });
});

