/**
 * Transactions Service Unit Tests
 * Tests for transaction business logic
 */

import { TransactionsService } from "./transactions.service";
import { TransactionsRepository } from "@/src/infrastructure/database/repositories/transactions.repository";
import { AccountsRepository } from "@/src/infrastructure/database/repositories/accounts.repository";
import { CategoriesRepository } from "@/src/infrastructure/database/repositories/categories.repository";
import { TransactionFormData } from "@/src/domain/transactions/transactions.validations";
import { createMockTransactionsRepository, mockTransactionRow } from "./__mocks__/transactions.repository.mock";

// Mock dependencies
jest.mock("@/src/infrastructure/database/supabase-server");
jest.mock("@/lib/utils/household", () => ({
  getActiveHouseholdId: jest.fn(() => Promise.resolve("test-household-id")),
}));
jest.mock("@/src/application/shared/feature-guard", () => ({
  getCurrentUserId: jest.fn(() => Promise.resolve("test-user-id")),
  guardTransactionLimit: jest.fn(() => Promise.resolve({ allowed: true })),
  throwIfNotAllowed: jest.fn(() => Promise.resolve()),
}));
import { requireTransactionOwnership } from "@/src/infrastructure/utils/security";

jest.mock("@/src/infrastructure/utils/security", () => ({
  requireTransactionOwnership: jest.fn(() => Promise.resolve()),
}));
jest.mock("@/src/infrastructure/utils/transaction-encryption", () => ({
  encryptDescription: jest.fn((desc) => `encrypted:${desc}`),
  decryptDescription: jest.fn((enc) => enc?.replace('encrypted:', '') || null),
  normalizeDescription: jest.fn((desc) => desc?.toLowerCase() || ''),
  getTransactionAmount: jest.fn((amount) => typeof amount === 'number' ? amount : parseFloat(amount) || 0),
}));
jest.mock("@/src/application/subscriptions/get-dashboard-subscription", () => ({
  getCachedSubscriptionData: jest.fn(() => Promise.resolve({
    limits: { maxTransactions: 1000 },
    plan: { name: "Pro" },
  })),
}));

describe("TransactionsService", () => {
  let transactionsService: TransactionsService;
  let mockTransactionsRepository: jest.Mocked<TransactionsRepository>;
  let mockAccountsRepository: jest.Mocked<AccountsRepository>;
  let mockCategoriesRepository: jest.Mocked<CategoriesRepository>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock repositories
    mockTransactionsRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      createTransferWithLimit: jest.fn(),
    } as any;

    mockAccountsRepository = {
      findByIds: jest.fn(),
    } as any;

    mockCategoriesRepository = {
      findCategoriesByIds: jest.fn().mockResolvedValue([]),
      findSubcategoriesByIds: jest.fn().mockResolvedValue([]),
    } as any;

    // Create service instance
    transactionsService = new TransactionsService(
      mockTransactionsRepository,
      mockAccountsRepository,
      mockCategoriesRepository
    );
  });

  describe("getTransactions", () => {
    it("should return transactions with relations", async () => {
      // Mock repository responses
      mockTransactionsRepository.count.mockResolvedValue(1);
      mockTransactionsRepository.findAll.mockResolvedValue([mockTransactionRow]);
      mockAccountsRepository.findByIds.mockResolvedValue([{
        id: "test-account-id",
        name: "Test Account",
        type: "checking",
        user_id: "test-user-id",
        credit_limit: null,
        initial_balance: null,

        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        due_day_of_month: null,
        extra_credit: 0,
        currency_code: 'USD',
        household_id: null,
        deleted_at: null,
      }]);
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

      // Execute
      const result = await transactionsService.getTransactions();

      // Assert
      expect(result.transactions).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.transactions[0].account).toBeDefined();
      expect(result.transactions[0].account?.name).toBe("Test Account");
    });

    it("should filter transactions by search term", async () => {
      // Mock repository responses
      mockTransactionsRepository.count.mockResolvedValue(2);
      mockTransactionsRepository.findAll.mockResolvedValue([
        mockTransactionRow,
        { ...mockTransactionRow, id: "tx-2", description: "encrypted:groceries" },
      ]);
      mockAccountsRepository.findByIds.mockResolvedValue([{
        id: "test-account-id",
        name: "Test Account",
        type: "checking",
        user_id: "test-user-id",
        credit_limit: null,
        initial_balance: null,

        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        due_day_of_month: null,
        extra_credit: 0,
        currency_code: 'USD',
        household_id: null,
        deleted_at: null,
      }]);
      mockCategoriesRepository.findCategoriesByIds.mockResolvedValue([{
        id: "test-category-id",
        name: "Food",
        type: "expense" as const,
        user_id: "test-user-id",
        is_system: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }]);
      mockCategoriesRepository.findSubcategoriesByIds.mockResolvedValue([]);

      // Execute with search filter
      const result = await transactionsService.getTransactions({ search: "groceries" });

      // Assert
      expect(result.transactions.length).toBeGreaterThan(0);
      expect(result.transactions.some(tx => tx.description?.includes("groceries"))).toBe(true);
    });

    it("should handle pagination", async () => {
      // Mock repository responses
      mockTransactionsRepository.count.mockResolvedValue(100);
      mockTransactionsRepository.findAll.mockResolvedValue([mockTransactionRow]);
      mockAccountsRepository.findByIds.mockResolvedValue([]);
      mockCategoriesRepository.findCategoriesByIds.mockResolvedValue([]);
      mockCategoriesRepository.findSubcategoriesByIds.mockResolvedValue([]);

      // Execute with pagination
      const result = await transactionsService.getTransactions({ page: 1, limit: 10 });

      // Assert
      expect(mockTransactionsRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 10 }),
        undefined,
        undefined
      );
      expect(result.total).toBe(100);
    });
  });

  describe("createTransaction", () => {
    const validTransactionData: TransactionFormData = {
      accountId: "test-account-id",
      type: "expense",
      amount: 100.50,
      date: new Date(),
      description: "Test transaction",
      categoryId: "test-category-id",
      recurring: false,
    };

    it("should create a transaction successfully", async () => {
      // Mock repository
      mockTransactionsRepository.create.mockResolvedValue(mockTransactionRow);
      // Mock accounts lookup
      mockAccountsRepository.findByIds.mockResolvedValue([{
        id: "test-account-id",
        name: "Test Account",
        type: "checking",
        user_id: "test-user-id",
        credit_limit: null,
        initial_balance: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        due_day_of_month: null,
        extra_credit: 0,
        currency_code: 'USD',
        household_id: null,
        deleted_at: null,
      }]);

      // Execute
      const result = await transactionsService.createTransaction(validTransactionData);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(mockTransactionRow.id);
      expect(mockTransactionsRepository.create).toHaveBeenCalled();
    });

    it("should encrypt description when creating transaction", async () => {
      // Mock repository
      mockTransactionsRepository.create.mockResolvedValue(mockTransactionRow);
      // Mock accounts lookup
      mockAccountsRepository.findByIds.mockResolvedValue([{
        id: "test-account-id",
        name: "Test Account",
        type: "checking",
        user_id: "test-user-id",
        credit_limit: null,
        initial_balance: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        due_day_of_month: null,
        extra_credit: 0,
        currency_code: 'USD',
        household_id: null,
        deleted_at: null,
      }]);

      // Execute
      await transactionsService.createTransaction(validTransactionData);

      // Assert
      const { encryptDescription } = require("@/src/infrastructure/utils/transaction-encryption");
      expect(encryptDescription).toHaveBeenCalledWith(validTransactionData.description);
    });

    it("should handle transfer transactions", async () => {
      const transferData: TransactionFormData = {
        ...validTransactionData,
        type: "transfer",
        toAccountId: "test-to-account-id",
      };

      // Mock repository
      mockTransactionsRepository.createTransferWithLimit.mockResolvedValue({
        id: "transfer-id",
      });
      mockTransactionsRepository.findById.mockResolvedValue(mockTransactionRow);
      // Mock accounts lookup
      mockAccountsRepository.findByIds.mockResolvedValue([{
        id: "test-account-id",
        name: "Test Account",
        type: "checking",
        user_id: "test-user-id",
        credit_limit: null,
        initial_balance: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        due_day_of_month: null,
        extra_credit: 0,
        currency_code: 'USD',
        household_id: null,
        deleted_at: null,
      }]);

      // Execute
      const result = await transactionsService.createTransaction(transferData);

      // Assert
      expect(mockTransactionsRepository.createTransferWithLimit).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe("updateTransaction", () => {
    it("should update a transaction successfully", async () => {
      const updateData: Partial<TransactionFormData> = {
        amount: 200.00,
        description: "Updated description",
      };

      // Mock repository
      mockTransactionsRepository.findById.mockResolvedValue(mockTransactionRow);
      mockTransactionsRepository.update.mockResolvedValue({
        ...mockTransactionRow,
        amount: 200.00,
      });
      // Mock accounts lookup
      mockAccountsRepository.findByIds.mockResolvedValue([{
        id: "test-account-id",
        name: "Test Account",
        type: "checking",
        user_id: "test-user-id",
        credit_limit: null,
        initial_balance: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        due_day_of_month: null,
        extra_credit: 0,
        currency_code: 'USD',
        household_id: null,
        deleted_at: null,
      }]);

      // Execute
      const result = await transactionsService.updateTransaction("test-transaction-id", updateData);

      // Assert
      expect(result).toBeDefined();
      expect(result.amount).toBe(200.00);
      expect(mockTransactionsRepository.update).toHaveBeenCalled();
    });

    it("should fail if transaction not found", async () => {
      // Mock repository
      mockTransactionsRepository.findById.mockResolvedValue(null);

      // Execute and assert
      await expect(
        transactionsService.updateTransaction("non-existent-id", { amount: 100 })
      ).rejects.toThrow();
    });
  });

  describe("deleteTransaction", () => {
    it("should delete a transaction successfully", async () => {
      // Mock repository
      mockTransactionsRepository.findById.mockResolvedValue(mockTransactionRow);
      mockTransactionsRepository.delete.mockResolvedValue(undefined);

      // Execute
      await transactionsService.deleteTransaction("test-transaction-id");

      // Assert
      expect(mockTransactionsRepository.delete).toHaveBeenCalledWith("test-transaction-id");
    });

    it("should fail if transaction not found", async () => {
      // Mock repository
      mockTransactionsRepository.findById.mockResolvedValue(null);
      (requireTransactionOwnership as jest.Mock).mockRejectedValue(new Error("Transaction not found"));

      // Execute and assert
      await expect(
        transactionsService.deleteTransaction("non-existent-id")
      ).rejects.toThrow();
    });
  });
});

