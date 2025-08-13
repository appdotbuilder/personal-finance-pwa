import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { profilesTable, accountsTable, categoriesTable, transactionsTable } from '../db/schema';
import { importTransactions } from '../handlers/import_transactions';
import { eq, and, isNull } from 'drizzle-orm';

// Test data setup
const testUserId = '123e4567-e89b-12d3-a456-426614174000';
const testAccountId = '223e4567-e89b-12d3-a456-426614174000';
const testCategoryId = '323e4567-e89b-12d3-a456-426614174000';
const testProfileId = '423e4567-e89b-12d3-a456-426614174000';

describe('importTransactions', () => {
  beforeEach(async () => {
    await createDB();
    
    // Create test profile
    await db.insert(profilesTable).values({
      id: testProfileId,
      user_id: testUserId,
      display_name: 'Test User',
      email: 'test@example.com',
      currency: 'IDR',
      locale: 'id-ID',
      timezone: 'Asia/Jakarta'
    }).execute();

    // Create test account
    await db.insert(accountsTable).values({
      id: testAccountId,
      user_id: testUserId,
      name: 'Test Account',
      account_type: 'checking',
      balance: '1000.00',
      initial_balance: '1000.00',
      currency: 'IDR'
    }).execute();

    // Create test category
    await db.insert(categoriesTable).values({
      id: testCategoryId,
      user_id: testUserId,
      name: 'Food',
      category_type: 'expense'
    }).execute();
  });

  afterEach(resetDB);

  it('should import valid transactions successfully', async () => {
    const transactionData = [
      {
        date: '2024-01-15',
        description: 'Grocery shopping',
        amount: 50000,
        category: 'Food',
        account: 'Test Account',
        type: 'expense' as const
      },
      {
        date: '2024-01-16',
        description: 'Salary payment',
        amount: 5000000,
        type: 'income' as const
      }
    ];

    const result = await importTransactions(transactionData, testUserId, testAccountId);

    expect(result.imported).toEqual(2);
    expect(result.skipped).toEqual(0);
    expect(result.errors).toHaveLength(0); // Both transactions should import successfully

    // Verify transactions were saved to database
    const savedTransactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.user_id, testUserId))
      .execute();

    expect(savedTransactions).toHaveLength(2);
    
    const groceryTransaction = savedTransactions.find(t => t.description === 'Grocery shopping');
    expect(groceryTransaction).toBeDefined();
    expect(parseFloat(groceryTransaction!.amount)).toEqual(50000);
    expect(groceryTransaction!.transaction_type).toEqual('expense');
    expect(groceryTransaction!.category_id).toEqual(testCategoryId);

    const salaryTransaction = savedTransactions.find(t => t.description === 'Salary payment');
    expect(salaryTransaction).toBeDefined();
    expect(parseFloat(salaryTransaction!.amount)).toEqual(5000000);
    expect(salaryTransaction!.transaction_type).toEqual('income');
    expect(salaryTransaction!.category_id).toBeNull();
  });

  it('should skip transactions with missing required fields', async () => {
    const transactionData = [
      {
        date: '',
        description: 'Invalid transaction',
        amount: 100,
        type: 'expense' as const
      },
      {
        date: '2024-01-15',
        description: '',
        amount: 200,
        type: 'income' as const
      },
      {
        date: '2024-01-15',
        description: 'Valid transaction',
        amount: 300,
        type: 'expense' as const
      }
    ];

    const result = await importTransactions(transactionData, testUserId, testAccountId);

    expect(result.imported).toEqual(1);
    expect(result.skipped).toEqual(2);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toMatch(/Row 1:.*Missing required fields/);
    expect(result.errors[1]).toMatch(/Row 2:.*Missing required fields/);
  });

  it('should skip transactions with invalid dates', async () => {
    const transactionData = [
      {
        date: 'invalid-date',
        description: 'Transaction with bad date',
        amount: 100,
        type: 'expense' as const
      },
      {
        date: '2024-13-45', // Invalid month and day
        description: 'Another bad date',
        amount: 200,
        type: 'income' as const
      }
    ];

    const result = await importTransactions(transactionData, testUserId, testAccountId);

    expect(result.imported).toEqual(0);
    expect(result.skipped).toEqual(2);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toMatch(/Row 1:.*Invalid date format/);
    expect(result.errors[1]).toMatch(/Row 2:.*Invalid date format/);
  });

  it('should skip transactions with invalid amounts', async () => {
    const transactionData = [
      {
        date: '2024-01-15',
        description: 'Negative amount',
        amount: -100,
        type: 'expense' as const
      },
      {
        date: '2024-01-15',
        description: 'Zero amount',
        amount: 0,
        type: 'income' as const
      }
    ];

    const result = await importTransactions(transactionData, testUserId, testAccountId);

    expect(result.imported).toEqual(0);
    expect(result.skipped).toEqual(2);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toMatch(/Row 1:.*Amount must be a positive number/);
    expect(result.errors[1]).toMatch(/Row 2:.*Amount must be a positive number/);
  });

  it('should skip transactions with invalid transaction types', async () => {
    const transactionData = [
      {
        date: '2024-01-15',
        description: 'Invalid type',
        amount: 100,
        type: 'invalid' as any
      }
    ];

    const result = await importTransactions(transactionData, testUserId, testAccountId);

    expect(result.imported).toEqual(0);
    expect(result.skipped).toEqual(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/Row 1:.*Invalid transaction type/);
  });

  it('should skip transactions when account not found', async () => {
    const transactionData = [
      {
        date: '2024-01-15',
        description: 'Transaction with unknown account',
        amount: 100,
        account: 'Nonexistent Account',
        type: 'expense' as const
      },
      {
        date: '2024-01-15',
        description: 'Transaction without account and no default',
        amount: 200,
        type: 'income' as const
      }
    ];

    const result = await importTransactions(transactionData, testUserId); // No default account

    expect(result.imported).toEqual(0);
    expect(result.skipped).toEqual(2);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toMatch(/Row 1:.*Account not found/);
    expect(result.errors[1]).toMatch(/Row 2:.*No account specified and no default account provided/);
  });

  it('should detect and skip potential duplicate transactions', async () => {
    // First, create an existing transaction
    await db.insert(transactionsTable).values({
      user_id: testUserId,
      account_id: testAccountId,
      transaction_type: 'expense',
      amount: '100.00',
      description: 'Grocery shopping',
      transaction_date: new Date('2024-01-15T10:00:00Z')
    }).execute();

    const transactionData = [
      {
        date: '2024-01-15',
        description: 'Grocery shopping', // Same description
        amount: 100, // Same amount
        type: 'expense' as const
      }
    ];

    const result = await importTransactions(transactionData, testUserId, testAccountId);

    expect(result.imported).toEqual(0);
    expect(result.skipped).toEqual(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/Row 1:.*Potential duplicate transaction skipped/);
  });

  it('should handle nonexistent categories gracefully', async () => {
    const transactionData = [
      {
        date: '2024-01-15',
        description: 'Transaction with unknown category',
        amount: 100,
        category: 'Unknown Category',
        type: 'expense' as const
      }
    ];

    const result = await importTransactions(transactionData, testUserId, testAccountId);

    expect(result.imported).toEqual(1); // Transaction still imported
    expect(result.skipped).toEqual(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/Row 1:.*Category not found.*transaction imported without category/);

    // Verify transaction was saved without category
    const savedTransactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.user_id, testUserId))
      .execute();

    expect(savedTransactions).toHaveLength(1);
    expect(savedTransactions[0].category_id).toBeNull();
  });

  it('should return error when no data provided', async () => {
    const result1 = await importTransactions([], testUserId, testAccountId);
    expect(result1.imported).toEqual(0);
    expect(result1.skipped).toEqual(0);
    expect(result1.errors).toHaveLength(1);
    expect(result1.errors[0]).toEqual('No transaction data provided');

    const result2 = await importTransactions(null as any, testUserId, testAccountId);
    expect(result2.imported).toEqual(0);
    expect(result2.skipped).toEqual(0);
    expect(result2.errors).toHaveLength(1);
    expect(result2.errors[0]).toEqual('No transaction data provided');
  });

  it('should return error when default account does not exist', async () => {
    const transactionData = [
      {
        date: '2024-01-15',
        description: 'Test transaction',
        amount: 100,
        type: 'expense' as const
      }
    ];

    const result = await importTransactions(transactionData, testUserId, 'nonexistent-account-id');

    expect(result.imported).toEqual(0);
    expect(result.skipped).toEqual(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual('Default account not found or does not belong to user');
  });

  it('should handle mixed success and failure scenarios', async () => {
    const transactionData = [
      {
        date: '2024-01-15',
        description: 'Valid transaction 1',
        amount: 100,
        type: 'expense' as const
      },
      {
        date: 'invalid-date',
        description: 'Invalid transaction',
        amount: 200,
        type: 'income' as const
      },
      {
        date: '2024-01-16',
        description: 'Valid transaction 2',
        amount: 300,
        category: 'Food',
        type: 'expense' as const
      }
    ];

    const result = await importTransactions(transactionData, testUserId, testAccountId);

    expect(result.imported).toEqual(2);
    expect(result.skipped).toEqual(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/Row 2:.*Invalid date format/);

    // Verify only valid transactions were saved
    const savedTransactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.user_id, testUserId))
      .execute();

    expect(savedTransactions).toHaveLength(2);
    const descriptions = savedTransactions.map(t => t.description);
    expect(descriptions).toContain('Valid transaction 1');
    expect(descriptions).toContain('Valid transaction 2');
    expect(descriptions).not.toContain('Invalid transaction');
  });
});