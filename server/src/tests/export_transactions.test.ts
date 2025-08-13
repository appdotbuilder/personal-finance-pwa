import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { profilesTable, accountsTable, categoriesTable, transactionsTable } from '../db/schema';
import { exportTransactions } from '../handlers/export_transactions';
import { eq } from 'drizzle-orm';

// Test data setup - using valid UUIDs
const testUserId = '550e8400-e29b-41d4-a716-446655440000';
const testAccountId = '550e8400-e29b-41d4-a716-446655440001';
const testCategoryId = '550e8400-e29b-41d4-a716-446655440002';
const secondAccountId = '550e8400-e29b-41d4-a716-446655440003';
const secondCategoryId = '550e8400-e29b-41d4-a716-446655440004';

describe('exportTransactions', () => {
    beforeEach(createDB);
    afterEach(resetDB);

    beforeEach(async () => {
        // Create test profile
        await db.insert(profilesTable).values({
            id: '550e8400-e29b-41d4-a716-446655440005',
            user_id: testUserId,
            display_name: 'Test User',
            email: 'test@example.com'
        }).execute();

        // Create test accounts
        await db.insert(accountsTable).values([
            {
                id: testAccountId,
                user_id: testUserId,
                name: 'Test Account',
                account_type: 'checking',
                initial_balance: '1000.00'
            },
            {
                id: secondAccountId,
                user_id: testUserId,
                name: 'Savings Account',
                account_type: 'savings',
                initial_balance: '5000.00'
            }
        ]).execute();

        // Create test categories
        await db.insert(categoriesTable).values([
            {
                id: testCategoryId,
                user_id: testUserId,
                name: 'Food & Dining',
                category_type: 'expense'
            },
            {
                id: secondCategoryId,
                user_id: testUserId,
                name: 'Salary',
                category_type: 'income'
            }
        ]).execute();

        // Create test transactions
        await db.insert(transactionsTable).values([
            {
                id: '550e8400-e29b-41d4-a716-446655440006',
                user_id: testUserId,
                account_id: testAccountId,
                category_id: testCategoryId,
                transaction_type: 'expense',
                amount: '50000.00',
                description: 'Restaurant dinner',
                notes: 'Birthday celebration',
                transaction_date: new Date('2024-01-15'),
                tags: ['food', 'celebration']
            },
            {
                id: '550e8400-e29b-41d4-a716-446655440007',
                user_id: testUserId,
                account_id: secondAccountId,
                category_id: secondCategoryId,
                transaction_type: 'income',
                amount: '5000000.00',
                description: 'Monthly salary',
                transaction_date: new Date('2024-01-01'),
                tags: ['salary']
            },
            {
                id: '550e8400-e29b-41d4-a716-446655440008',
                user_id: testUserId,
                account_id: testAccountId,
                to_account_id: secondAccountId,
                transaction_type: 'transfer',
                amount: '100000.00',
                description: 'Transfer to savings',
                transaction_date: new Date('2024-01-10'),
                tags: []
            }
        ]).execute();
    });

    it('should export transactions in CSV format', async () => {
        const result = await exportTransactions(testUserId, {
            format: 'csv'
        });

        expect(result.filename).toMatch(/transactions_\d{4}-\d{2}-\d{2}\.csv/);
        expect(result.mimeType).toEqual('text/csv');
        expect(result.data).toBeDefined();

        // Check CSV headers in Indonesian
        const lines = result.data.split('\n');
        expect(lines[0]).toEqual('ID,Tanggal,Deskripsi,Jumlah,Tipe,Akun,Akun Tujuan,Kategori,Catatan,Tag');

        // Check data rows
        expect(lines.length).toEqual(4); // Header + 3 transactions
        expect(lines[1]).toContain('550e8400-e29b-41d4-a716-446655440006');
        expect(lines[1]).toContain('Restaurant dinner');
        expect(lines[1]).toContain('expense');
    });

    it('should export transactions in JSON format', async () => {
        const result = await exportTransactions(testUserId, {
            format: 'json'
        });

        expect(result.filename).toMatch(/transactions_\d{4}-\d{2}-\d{2}\.json/);
        expect(result.mimeType).toEqual('application/json');
        
        const data = JSON.parse(result.data);
        expect(Array.isArray(data)).toBe(true);
        expect(data.length).toEqual(3);

        // Check first transaction data
        const firstTransaction = data.find((t: any) => t.id === '550e8400-e29b-41d4-a716-446655440006');
        expect(firstTransaction).toBeDefined();
        expect(firstTransaction.description).toEqual('Restaurant dinner');
        expect(firstTransaction.transaction_type).toEqual('expense');
        expect(firstTransaction.account_name).toEqual('Test Account');
        expect(firstTransaction.category_name).toEqual('Food & Dining');
        expect(firstTransaction.tags).toEqual('food, celebration');
    });

    it('should export transactions in Excel format with BOM', async () => {
        const result = await exportTransactions(testUserId, {
            format: 'excel'
        });

        expect(result.filename).toMatch(/transactions_\d{4}-\d{2}-\d{2}\.csv/);
        expect(result.mimeType).toEqual('text/csv');
        
        // Check for UTF-8 BOM
        expect(result.data.charCodeAt(0)).toEqual(0xFEFF);
        
        // Remove BOM and check content
        const content = result.data.substring(1);
        const lines = content.split('\n');
        expect(lines[0]).toEqual('ID,Tanggal,Deskripsi,Jumlah,Tipe,Akun,Akun Tujuan,Kategori,Catatan,Tag');
    });

    it('should filter transactions by date range', async () => {
        const result = await exportTransactions(testUserId, {
            format: 'json',
            startDate: new Date('2024-01-10'),
            endDate: new Date('2024-01-20')
        });

        const data = JSON.parse(result.data);
        expect(data.length).toEqual(2); // Should include transactions on 2024-01-10 and 2024-01-15

        const transactionIds = data.map((t: any) => t.id);
        expect(transactionIds).toContain('550e8400-e29b-41d4-a716-446655440006'); // 2024-01-15
        expect(transactionIds).toContain('550e8400-e29b-41d4-a716-446655440008'); // 2024-01-10
        expect(transactionIds).not.toContain('550e8400-e29b-41d4-a716-446655440007'); // 2024-01-01 is outside range
    });

    it('should filter transactions by account IDs', async () => {
        const result = await exportTransactions(testUserId, {
            format: 'json',
            accountIds: [testAccountId]
        });

        const data = JSON.parse(result.data);
        expect(data.length).toEqual(2); // Should include transactions from testAccountId only

        data.forEach((transaction: any) => {
            expect(transaction.account_name).toEqual('Test Account');
        });
    });

    it('should filter transactions by category IDs', async () => {
        const result = await exportTransactions(testUserId, {
            format: 'json',
            categoryIds: [testCategoryId]
        });

        const data = JSON.parse(result.data);
        expect(data.length).toEqual(1); // Should include only expense transaction

        expect(data[0].id).toEqual('550e8400-e29b-41d4-a716-446655440006');
        expect(data[0].category_name).toEqual('Food & Dining');
    });

    it('should handle transfer transactions correctly', async () => {
        const result = await exportTransactions(testUserId, {
            format: 'json'
        });

        const data = JSON.parse(result.data);
        const transferTransaction = data.find((t: any) => t.transaction_type === 'transfer');
        
        expect(transferTransaction).toBeDefined();
        expect(transferTransaction.account_name).toEqual('Test Account');
        expect(transferTransaction.to_account_name).toEqual('Savings Account');
        expect(transferTransaction.category_name).toEqual('');
    });

    it('should format Indonesian currency correctly', async () => {
        const result = await exportTransactions(testUserId, {
            format: 'json'
        });

        const data = JSON.parse(result.data);
        const salaryTransaction = data.find((t: any) => t.id === '550e8400-e29b-41d4-a716-446655440007');
        
        // Test that currency is properly formatted with Indonesian locale
        expect(salaryTransaction.amount).toMatch(/^Rp\s*5\.000\.000,00$/);
        expect(typeof salaryTransaction.amount).toBe('string');
        expect(salaryTransaction.amount).toContain('5.000.000');
        expect(salaryTransaction.amount).toContain('Rp');
    });

    it('should format Indonesian dates correctly', async () => {
        const result = await exportTransactions(testUserId, {
            format: 'json'
        });

        const data = JSON.parse(result.data);
        const transaction = data.find((t: any) => t.id === '550e8400-e29b-41d4-a716-446655440006');
        
        // Indonesian date format: dd/mm/yyyy
        expect(transaction.transaction_date).toEqual('15/01/2024');
    });

    it('should handle transactions with null categories and notes', async () => {
        // Create transaction without category and notes
        await db.insert(transactionsTable).values({
            id: '550e8400-e29b-41d4-a716-446655440009',
            user_id: testUserId,
            account_id: testAccountId,
            transaction_type: 'expense',
            amount: '25000.00',
            description: 'Cash withdrawal',
            transaction_date: new Date('2024-01-20'),
            tags: []
        }).execute();

        const result = await exportTransactions(testUserId, {
            format: 'json'
        });

        const data = JSON.parse(result.data);
        const nullTransaction = data.find((t: any) => t.id === '550e8400-e29b-41d4-a716-446655440009');
        
        expect(nullTransaction.category_name).toEqual('');
        expect(nullTransaction.notes).toEqual('');
        expect(nullTransaction.tags).toEqual('');
    });

    it('should handle empty results', async () => {
        // Filter by future date range
        const result = await exportTransactions(testUserId, {
            format: 'json',
            startDate: new Date('2025-01-01'),
            endDate: new Date('2025-12-31')
        });

        const data = JSON.parse(result.data);
        expect(data.length).toEqual(0);
        expect(result.filename).toBeDefined();
        expect(result.mimeType).toEqual('application/json');
    });

    it('should handle multiple filter conditions', async () => {
        const result = await exportTransactions(testUserId, {
            format: 'json',
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-01-15'),
            accountIds: [testAccountId],
            categoryIds: [testCategoryId]
        });

        const data = JSON.parse(result.data);
        expect(data.length).toEqual(1); // Only transaction-1 matches all criteria

        expect(data[0].id).toEqual('550e8400-e29b-41d4-a716-446655440006');
        expect(data[0].account_name).toEqual('Test Account');
        expect(data[0].category_name).toEqual('Food & Dining');
    });

    it('should handle deleted transactions when includeDeleted is true', async () => {
        // Mark one transaction as deleted
        await db.update(transactionsTable)
            .set({ deleted_at: new Date() })
            .where(eq(transactionsTable.id, '550e8400-e29b-41d4-a716-446655440006'))
            .execute();

        // Export without deleted transactions (default)
        const resultExcluded = await exportTransactions(testUserId, {
            format: 'json'
        });
        const dataExcluded = JSON.parse(resultExcluded.data);
        expect(dataExcluded.length).toEqual(2);

        // Export with deleted transactions
        const resultIncluded = await exportTransactions(testUserId, {
            format: 'json',
            includeDeleted: true
        });
        const dataIncluded = JSON.parse(resultIncluded.data);
        expect(dataIncluded.length).toEqual(3);
    });

    it('should throw error for unsupported format', async () => {
        await expect(exportTransactions(testUserId, {
            format: 'xml' as any
        })).rejects.toThrow(/Unsupported format: xml/i);
    });
});