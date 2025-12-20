
import { PlaidMapper } from '@/src/application/plaid/plaid.mapper';
import { PlaidTransaction } from '@/src/domain/plaid/plaid.types';

describe('PlaidMapper', () => {
    const mockPlaidTx: PlaidTransaction = {
        transactionId: 'tx-123',
        accountId: 'acc-123',
        amount: 100,
        date: '2023-01-01',
        authorizedDate: null,
        name: 'Test Transaction',
        merchantName: 'Test Merchant',
        category: ['Shops', 'Supermarkets'],
        categoryId: '19046000',
        primaryCategory: 'GENERAL_MERCHANDISE',
        detailedCategory: 'GENERAL_MERCHANDISE_SUPERSTORES',
        isoCurrencyCode: 'USD',
        unofficialCurrencyCode: null,
        paymentChannel: 'in store',
        pending: false,
        accountOwner: null,
    };

    const accountId = 'internal-acc-123';
    const userId = 'user-123';
    const householdId = 'household-123';

    describe('plaidTransactionToDomain', () => {
        it('should map positive amount to expense', () => {
            const result = PlaidMapper.plaidTransactionToDomain(
                { ...mockPlaidTx, amount: 50 },
                accountId,
                userId,
                householdId
            );

            expect(result.type).toBe('expense');
            expect(result.amount).toBe(50);
        });

        it('should map negative amount to income', () => {
            const result = PlaidMapper.plaidTransactionToDomain(
                { ...mockPlaidTx, amount: -50 },
                accountId,
                userId,
                householdId
            );

            expect(result.type).toBe('income');
            expect(result.amount).toBe(50);
        });

        it('should map transfer when paymentChannel is transfer', () => {
            const result = PlaidMapper.plaidTransactionToDomain(
                { ...mockPlaidTx, paymentChannel: 'transfer' },
                accountId,
                userId,
                householdId
            );

            expect(result.type).toBe('transfer');
        });

        it('should map transfer when category includes Transfer', () => {
            const result = PlaidMapper.plaidTransactionToDomain(
                { ...mockPlaidTx, category: ['Transfer', 'Debit'] },
                accountId,
                userId,
                householdId
            );

            expect(result.type).toBe('transfer');
        });

        it('should NOT map wire transfer as transfer if excluded (current logic excludes wire)', () => {
            // Based on current implementation logic: !c.toLowerCase().includes('wire')
            // So 'Wire Transfer' should NOT be a transfer based on that specific check but might fall through if other checks pass
            // Let's test the specific logic branch
            const result = PlaidMapper.plaidTransactionToDomain(
                { ...mockPlaidTx, category: ['Wire Transfer'], paymentChannel: 'other' },
                accountId,
                userId,
                householdId
            );

            expect(result.type).not.toBe('transfer');
        });

        it('should map transfer when primaryCategory is TRANSFER_IN', () => {
            const result = PlaidMapper.plaidTransactionToDomain(
                { ...mockPlaidTx, primaryCategory: 'TRANSFER_IN' },
                accountId,
                userId,
                householdId
            );

            expect(result.type).toBe('transfer');
        });

        it('should map transfer when primaryCategory is TRANSFER_OUT', () => {
            const result = PlaidMapper.plaidTransactionToDomain(
                { ...mockPlaidTx, primaryCategory: 'TRANSFER_OUT' },
                accountId,
                userId,
                householdId
            );

            expect(result.type).toBe('transfer');
        });
    });
});
