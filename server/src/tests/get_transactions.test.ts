import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { profilesTable, accountsTable, categoriesTable, transactionsTable } from '../db/schema';
import { type GetTransactionsInput } from '../schema';
import { getTransactions } from '../handlers/get_transactions';

// Test data
const testUserId = '550e8400-e29b-41d4-a716-446655440000';
const otherUserId = '550e8400-e29b-41d4-a716-446655440001';

const testProfile = {
  user_id: testUserId,
  display_name: 'Test User',
  email: 'test@example.com',
  currency: 'IDR',
  locale: 'id-ID',
  timezone: 'Asia/Jakarta'
};

const testAccount = {
  user_id: testUserId,
  name: 'Test Account',
  account_type: 'checking' as const,
  initial_balance: '1000',
  currency: 'IDR',
  is_default: true
};

const testCategory = {
  user_id: testUserId,
  name: 'Test Category',
  category_type: 'expense' as const,
  is_system: false
};

const baseTransactionInput = {
  user_id: testUserId,
  transaction_type: 'expense' as const,
  amount: '100.50',
  description: 'Test transaction',
  transaction_date: new Date('2024-01-15T10:00:00Z')
};

describe('getTransactions', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty results for user with no transactions', async () => {
    // Create user profile
    await db.insert(profilesTable).values(testProfile);

    const input: GetTransactionsInput = {
      limit: 50,
      offset: 0
    };

    const result = await getTransactions(input, testUserId);

    expect(result.transactions).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('should return transactions for user with proper data conversion', async () => {
    // Create prerequisites
    await db.insert(profilesTable).values(testProfile);
    const accountResult = await db.insert(accountsTable).values(testAccount).returning();
    const categoryResult = await db.insert(categoriesTable).values(testCategory).returning();

    // Create test transaction
    const transactionData = {
      ...baseTransactionInput,
      account_id: accountResult[0].id,
      category_id: categoryResult[0].id
    };
    
    await db.insert(transactionsTable).values(transactionData);

    const input: GetTransactionsInput = {
      limit: 50,
      offset: 0
    };

    const result = await getTransactions(input, testUserId);

    expect(result.transactions).toHaveLength(1);
    expect(result.total).toBe(1);
    
    const transaction = result.transactions[0];
    expect(transaction.description).toBe('Test transaction');
    expect(transaction.amount).toBe(100.50);
    expect(typeof transaction.amount).toBe('number');
    expect(transaction.transaction_type).toBe('expense');
    expect(transaction.account_id).toBe(accountResult[0].id);
    expect(transaction.category_id).toBe(categoryResult[0].id);
    expect(transaction.user_id).toBe(testUserId);
  });

  it('should filter transactions by account_id', async () => {
    // Create prerequisites
    await db.insert(profilesTable).values(testProfile);
    const accountResults = await db.insert(accountsTable).values([
      testAccount,
      { ...testAccount, name: 'Account 2' }
    ]).returning();
    const categoryResult = await db.insert(categoriesTable).values(testCategory).returning();

    // Create transactions for different accounts
    await db.insert(transactionsTable).values([
      {
        ...baseTransactionInput,
        account_id: accountResults[0].id,
        category_id: categoryResult[0].id,
        description: 'Transaction 1'
      },
      {
        ...baseTransactionInput,
        account_id: accountResults[1].id,
        category_id: categoryResult[0].id,
        description: 'Transaction 2'
      }
    ]);

    const input: GetTransactionsInput = {
      account_id: accountResults[0].id,
      limit: 50,
      offset: 0
    };

    const result = await getTransactions(input, testUserId);

    expect(result.transactions).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.transactions[0].description).toBe('Transaction 1');
    expect(result.transactions[0].account_id).toBe(accountResults[0].id);
  });

  it('should filter transactions by category_id', async () => {
    // Create prerequisites
    await db.insert(profilesTable).values(testProfile);
    const accountResult = await db.insert(accountsTable).values(testAccount).returning();
    const categoryResults = await db.insert(categoriesTable).values([
      testCategory,
      { ...testCategory, name: 'Category 2' }
    ]).returning();

    // Create transactions for different categories
    await db.insert(transactionsTable).values([
      {
        ...baseTransactionInput,
        account_id: accountResult[0].id,
        category_id: categoryResults[0].id,
        description: 'Transaction 1'
      },
      {
        ...baseTransactionInput,
        account_id: accountResult[0].id,
        category_id: categoryResults[1].id,
        description: 'Transaction 2'
      }
    ]);

    const input: GetTransactionsInput = {
      category_id: categoryResults[0].id,
      limit: 50,
      offset: 0
    };

    const result = await getTransactions(input, testUserId);

    expect(result.transactions).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.transactions[0].description).toBe('Transaction 1');
    expect(result.transactions[0].category_id).toBe(categoryResults[0].id);
  });

  it('should filter transactions by transaction_type', async () => {
    // Create prerequisites
    await db.insert(profilesTable).values(testProfile);
    const accountResult = await db.insert(accountsTable).values(testAccount).returning();
    const categoryResult = await db.insert(categoriesTable).values(testCategory).returning();

    // Create transactions of different types
    await db.insert(transactionsTable).values([
      {
        ...baseTransactionInput,
        account_id: accountResult[0].id,
        category_id: categoryResult[0].id,
        transaction_type: 'expense',
        description: 'Expense transaction'
      },
      {
        ...baseTransactionInput,
        account_id: accountResult[0].id,
        category_id: categoryResult[0].id,
        transaction_type: 'income',
        description: 'Income transaction'
      }
    ]);

    const input: GetTransactionsInput = {
      transaction_type: 'income',
      limit: 50,
      offset: 0
    };

    const result = await getTransactions(input, testUserId);

    expect(result.transactions).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.transactions[0].description).toBe('Income transaction');
    expect(result.transactions[0].transaction_type).toBe('income');
  });

  it('should filter transactions by date range', async () => {
    // Create prerequisites
    await db.insert(profilesTable).values(testProfile);
    const accountResult = await db.insert(accountsTable).values(testAccount).returning();
    const categoryResult = await db.insert(categoriesTable).values(testCategory).returning();

    // Create transactions with different dates
    await db.insert(transactionsTable).values([
      {
        ...baseTransactionInput,
        account_id: accountResult[0].id,
        category_id: categoryResult[0].id,
        transaction_date: new Date('2024-01-10T10:00:00Z'),
        description: 'Old transaction'
      },
      {
        ...baseTransactionInput,
        account_id: accountResult[0].id,
        category_id: categoryResult[0].id,
        transaction_date: new Date('2024-01-15T10:00:00Z'),
        description: 'Middle transaction'
      },
      {
        ...baseTransactionInput,
        account_id: accountResult[0].id,
        category_id: categoryResult[0].id,
        transaction_date: new Date('2024-01-20T10:00:00Z'),
        description: 'New transaction'
      }
    ]);

    const input: GetTransactionsInput = {
      start_date: new Date('2024-01-12T00:00:00Z'),
      end_date: new Date('2024-01-18T23:59:59Z'),
      limit: 50,
      offset: 0
    };

    const result = await getTransactions(input, testUserId);

    expect(result.transactions).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.transactions[0].description).toBe('Middle transaction');
  });

  it('should handle pagination correctly', async () => {
    // Create prerequisites
    await db.insert(profilesTable).values(testProfile);
    const accountResult = await db.insert(accountsTable).values(testAccount).returning();
    const categoryResult = await db.insert(categoriesTable).values(testCategory).returning();

    // Create multiple transactions
    const transactions = [];
    for (let i = 1; i <= 5; i++) {
      transactions.push({
        ...baseTransactionInput,
        account_id: accountResult[0].id,
        category_id: categoryResult[0].id,
        description: `Transaction ${i}`,
        transaction_date: new Date(`2024-01-${15 + i}T10:00:00Z`)
      });
    }
    await db.insert(transactionsTable).values(transactions);

    // Test first page
    const firstPage = await getTransactions({
      limit: 2,
      offset: 0
    }, testUserId);

    expect(firstPage.transactions).toHaveLength(2);
    expect(firstPage.total).toBe(5);
    
    // Should be ordered by transaction_date desc, then created_at desc
    expect(firstPage.transactions[0].description).toBe('Transaction 5');
    expect(firstPage.transactions[1].description).toBe('Transaction 4');

    // Test second page
    const secondPage = await getTransactions({
      limit: 2,
      offset: 2
    }, testUserId);

    expect(secondPage.transactions).toHaveLength(2);
    expect(secondPage.total).toBe(5);
    expect(secondPage.transactions[0].description).toBe('Transaction 3');
    expect(secondPage.transactions[1].description).toBe('Transaction 2');
  });

  it('should only return transactions for the specified user', async () => {
    // Create profiles for both users
    await db.insert(profilesTable).values([
      testProfile,
      { ...testProfile, user_id: otherUserId, email: 'other@example.com' }
    ]);

    // Create accounts for both users
    const accountResults = await db.insert(accountsTable).values([
      testAccount,
      { ...testAccount, user_id: otherUserId }
    ]).returning();

    const categoryResults = await db.insert(categoriesTable).values([
      testCategory,
      { ...testCategory, user_id: otherUserId }
    ]).returning();

    // Create transactions for both users
    await db.insert(transactionsTable).values([
      {
        ...baseTransactionInput,
        user_id: testUserId,
        account_id: accountResults[0].id,
        category_id: categoryResults[0].id,
        description: 'User 1 transaction'
      },
      {
        ...baseTransactionInput,
        user_id: otherUserId,
        account_id: accountResults[1].id,
        category_id: categoryResults[1].id,
        description: 'User 2 transaction'
      }
    ]);

    const result = await getTransactions({
      limit: 50,
      offset: 0
    }, testUserId);

    expect(result.transactions).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.transactions[0].description).toBe('User 1 transaction');
    expect(result.transactions[0].user_id).toBe(testUserId);
  });

  it('should combine multiple filters correctly', async () => {
    // Create prerequisites
    await db.insert(profilesTable).values(testProfile);
    const accountResults = await db.insert(accountsTable).values([
      testAccount,
      { ...testAccount, name: 'Account 2' }
    ]).returning();
    const categoryResults = await db.insert(categoriesTable).values([
      testCategory,
      { ...testCategory, name: 'Category 2' }
    ]).returning();

    // Create various transactions
    await db.insert(transactionsTable).values([
      {
        ...baseTransactionInput,
        account_id: accountResults[0].id,
        category_id: categoryResults[0].id,
        transaction_type: 'expense',
        transaction_date: new Date('2024-01-15T10:00:00Z'),
        description: 'Matching transaction'
      },
      {
        ...baseTransactionInput,
        account_id: accountResults[1].id, // Different account
        category_id: categoryResults[0].id,
        transaction_type: 'expense',
        transaction_date: new Date('2024-01-15T10:00:00Z'),
        description: 'Wrong account'
      },
      {
        ...baseTransactionInput,
        account_id: accountResults[0].id,
        category_id: categoryResults[0].id,
        transaction_type: 'income', // Different type
        transaction_date: new Date('2024-01-15T10:00:00Z'),
        description: 'Wrong type'
      },
      {
        ...baseTransactionInput,
        account_id: accountResults[0].id,
        category_id: categoryResults[0].id,
        transaction_type: 'expense',
        transaction_date: new Date('2024-01-10T10:00:00Z'), // Outside date range
        description: 'Wrong date'
      }
    ]);

    const input: GetTransactionsInput = {
      account_id: accountResults[0].id,
      transaction_type: 'expense',
      start_date: new Date('2024-01-12T00:00:00Z'),
      end_date: new Date('2024-01-18T23:59:59Z'),
      limit: 50,
      offset: 0
    };

    const result = await getTransactions(input, testUserId);

    expect(result.transactions).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.transactions[0].description).toBe('Matching transaction');
  });
});