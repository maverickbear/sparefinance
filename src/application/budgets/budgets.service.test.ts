/**
 * Budgets Service Unit Tests
 * Tests for budget business logic
 */

import { BudgetsService } from "./budgets.service";
import { BudgetsRepository } from "@/src/infrastructure/database/repositories/budgets.repository";
import { CategoriesRepository } from "@/src/infrastructure/database/repositories/categories.repository";
import { TransactionsRepository } from "@/src/infrastructure/database/repositories/transactions.repository";
import { BudgetFormData } from "@/src/domain/budgets/budgets.validations";
import { createMockBudgetsRepository, mockBudgetRow } from "./__mocks__/budgets.repository.mock";

// Mock dependencies
jest.mock("@/src/infrastructure/database/supabase-server", () => ({
  createServerClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          limit: jest.fn(() => ({
            maybeSingle: jest.fn(() => Promise.resolve({ data: null })),
          })),
        })),
      })),
    })),
  })),
}));
jest.mock("@/src/application/shared/feature-guard", () => ({
  getCurrentUserId: jest.fn(() => Promise.resolve("test-user-id")),
}));
jest.mock("@/src/infrastructure/utils/security", () => ({
  requireBudgetOwnership: jest.fn(() => Promise.resolve()),
}));
jest.mock("@/src/infrastructure/utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("BudgetsService", () => {
  let budgetsService: BudgetsService;
  let mockBudgetsRepository: jest.Mocked<BudgetsRepository>;
  let mockCategoriesRepository: jest.Mocked<CategoriesRepository>;
  let mockTransactionsRepository: jest.Mocked<TransactionsRepository>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock repositories
    mockBudgetsRepository = {
      findAllByPeriod: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getBudgetSpendingByPeriod: jest.fn(),
      findRecurringBudgetsBeforePeriod: jest.fn(),
      existsForPeriod: jest.fn(),
    } as any;

    mockCategoriesRepository = {
      findCategoriesByIds: jest.fn(),
      findSubcategoriesByIds: jest.fn(),
      // NOTE: findGroupsByIds removed - groups are no longer part of the system
      findCategoryById: jest.fn(),
      findSubcategoryById: jest.fn(),
      findGroupById: jest.fn(),
    } as any;

    mockTransactionsRepository = {} as any;

    // Create service instance
    budgetsService = new BudgetsService(
      mockBudgetsRepository,
      mockCategoriesRepository,
      mockTransactionsRepository
    );
  });

  describe("getBudgets", () => {
    const testPeriod = new Date(2025, 0, 1); // January 2025

    it("should return budgets with actual spend from materialized view", async () => {
      // Mock repository responses
      mockBudgetsRepository.findAllByPeriod.mockResolvedValue([mockBudgetRow]);
      mockBudgetsRepository.getBudgetSpendingByPeriod.mockResolvedValue(
        new Map([
          ["category:test-category-id", {
            categoryId: "test-category-id",
            subcategoryId: null,
            actualSpend: 500.00,
            transactionCount: 5,
          }],
        ])
      );
      mockCategoriesRepository.findCategoriesByIds.mockResolvedValue([{
        id: "test-category-id",
        name: "Test Category",
        type: "expense" as const,
        user_id: "test-user-id",
        is_system: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }]);
      mockCategoriesRepository.findSubcategoriesByIds.mockResolvedValue([]);
      // NOTE: Groups removed - no longer needed

      // Execute
      const result = await budgetsService.getBudgets(testPeriod);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].actualSpend).toBe(500.00);
      expect(result[0].percentage).toBe(50); // 500 / 1000 * 100
      expect(result[0].status).toBe("ok");
      expect(mockBudgetsRepository.getBudgetSpendingByPeriod).toHaveBeenCalled();
    });

    it("should fall back to runtime calculation if materialized view fails", async () => {
      // Mock repository responses
      mockBudgetsRepository.findAllByPeriod.mockResolvedValue([mockBudgetRow]);
      mockBudgetsRepository.getBudgetSpendingByPeriod.mockRejectedValue(
        new Error("Materialized view not available")
      );

      // Mock Supabase for runtime calculation
      const { createServerClient } = require("@/src/infrastructure/database/supabase-server");
      const mockSupabase = createServerClient();
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            not: jest.fn(() => ({
              gte: jest.fn(() => ({
                lte: jest.fn(() => ({
                  order: jest.fn(() => Promise.resolve({
                    data: [{
                      categoryId: "test-category-id",
                      subcategoryId: null,
                      amount: 300.00,
                    }],
                    error: null,
                  })),
                })),
              })),
            })),
          })),
        })),
      });

      mockCategoriesRepository.findCategoriesByIds.mockResolvedValue([{
        id: "test-category-id",
        name: "Test Category",
        type: "expense" as const,
        user_id: "test-user-id",
        is_system: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }]);
      mockCategoriesRepository.findSubcategoriesByIds.mockResolvedValue([]);
      // NOTE: Groups removed - no longer needed

      // Execute
      const result = await budgetsService.getBudgets(testPeriod);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].actualSpend).toBe(300.00);
      // Should have attempted to use materialized view first
      expect(mockBudgetsRepository.getBudgetSpendingByPeriod).toHaveBeenCalled();
    });

    it("should return empty array if no budgets found", async () => {
      // Mock repository responses
      mockBudgetsRepository.findAllByPeriod.mockResolvedValue([]);

      // Execute
      const result = await budgetsService.getBudgets(testPeriod);

      // Assert
      expect(result).toHaveLength(0);
    });
  });

  describe("createBudget", () => {
    const validBudgetData: BudgetFormData = {
      period: new Date(2025, 0, 1),
      amount: 1000.00,
      categoryId: "test-category-id",
      subcategoryId: undefined,
      note: "Test budget",
      isRecurring: false,
    };

    it("should create a budget successfully", async () => {
      // Mock repository
      mockBudgetsRepository.create.mockResolvedValue(mockBudgetRow);

      // Execute
      const result = await budgetsService.createBudget(validBudgetData);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(mockBudgetRow.id);
      expect(mockBudgetsRepository.create).toHaveBeenCalled();
    });

    it("should format period correctly", async () => {
      // Mock repository
      mockBudgetsRepository.create.mockResolvedValue(mockBudgetRow);

      // Execute
      await budgetsService.createBudget(validBudgetData);

      // Assert
      expect(mockBudgetsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          period: expect.stringMatching(/^\d{4}-\d{2}-\d{2}/),
        })
      );
    });
  });

  describe("updateBudget", () => {
    it("should update a budget successfully", async () => {
      const updateData = {
        amount: 2000.00,
        note: "Updated note",
      };

      // Mock repository
      mockBudgetsRepository.findById.mockResolvedValue(mockBudgetRow);
      mockBudgetsRepository.update.mockResolvedValue({
        ...mockBudgetRow,
        amount: 2000.00,
        note: "Updated note",
      });

      // Execute
      const result = await budgetsService.updateBudget("test-budget-id", updateData);

      // Assert
      expect(result).toBeDefined();
      expect(result.amount).toBe(2000.00);
      expect(mockBudgetsRepository.update).toHaveBeenCalled();
    });

    it("should fail if budget not found", async () => {
      // Mock repository
      mockBudgetsRepository.findById.mockResolvedValue(null);

      // Execute and assert
      await expect(
        budgetsService.updateBudget("non-existent-id", { amount: 1000 })
      ).rejects.toThrow();
    });
  });

  describe("deleteBudget", () => {
    it("should delete a budget successfully", async () => {
      // Mock repository
      mockBudgetsRepository.findById.mockResolvedValue(mockBudgetRow);
      mockBudgetsRepository.delete.mockResolvedValue(undefined);

      // Execute
      await budgetsService.deleteBudget("test-budget-id");

      // Assert
      expect(mockBudgetsRepository.delete).toHaveBeenCalledWith("test-budget-id");
    });

    it("should fail if budget not found", async () => {
      // Mock repository
      mockBudgetsRepository.findById.mockResolvedValue(null);

      // Execute and assert
      await expect(
        budgetsService.deleteBudget("non-existent-id")
      ).rejects.toThrow();
    });
  });
});

