import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { accountsTable, categoriesTable, transactionsTable } from '../db/schema';
import { type CreateTransactionInput } from '../schema';
import { createTransaction } from '../handlers/create_transaction';
import { eq } from 'drizzle-orm';

const testUserId = '550e8400-e29b-41d4-a716-446655440000';

describe('createTransaction', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create an income transaction and update account balance', async () => {
    // Create test account
    const account = await db.insert(accountsTable)
      .values({
        user_id: testUserId,
        name: 'Test Checking',
        account_type: 'checking',
        balance: '1000.00',
        initial_balance: '1000.00'
      })
      .returning()
      .execute();

    // Create test category
    const category = await db.insert(categoriesTable)
      .values({
        user_id: testUserId,
        name: 'Salary',
        category_type: 'income'
      })
      .returning()
      .execute();

    const input: CreateTransactionInput = {
      account_id: account[0].id,
      category_id: category[0].id,
      transaction_type: 'income',
      amount: 500.00,
      description: 'Monthly salary',
      notes: 'Test income transaction',
      transaction_date: new Date(),
      tags: ['salary', 'monthly']
    };

    const result = await createTransaction(input, testUserId);

    // Verify transaction fields
    expect(result.user_id).toEqual(testUserId);
    expect(result.account_id).toEqual(account[0].id);
    expect(result.category_id).toEqual(category[0].id);
    expect(result.transaction_type).toEqual('income');
    expect(result.amount).toEqual(500.00);
    expect(typeof result.amount).toEqual('number');
    expect(result.description).toEqual('Monthly salary');
    expect(result.notes).toEqual('Test income transaction');
    expect(result.tags).toEqual(['salary', 'monthly']);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);

    // Verify account balance was updated
    const updatedAccount = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.id, account[0].id))
      .execute();

    expect(parseFloat(updatedAccount[0].balance)).toEqual(1500.00);
  });

  it('should create an expense transaction and update account balance', async () => {
    // Create test account
    const account = await db.insert(accountsTable)
      .values({
        user_id: testUserId,
        name: 'Test Checking',
        account_type: 'checking',
        balance: '1000.00',
        initial_balance: '1000.00'
      })
      .returning()
      .execute();

    // Create test category
    const category = await db.insert(categoriesTable)
      .values({
        user_id: testUserId,
        name: 'Food',
        category_type: 'expense'
      })
      .returning()
      .execute();

    const input: CreateTransactionInput = {
      account_id: account[0].id,
      category_id: category[0].id,
      transaction_type: 'expense',
      amount: 200.50,
      description: 'Grocery shopping',
      transaction_date: new Date(),
      tags: ['food', 'grocery']
    };

    const result = await createTransaction(input, testUserId);

    // Verify transaction fields
    expect(result.transaction_type).toEqual('expense');
    expect(result.amount).toEqual(200.50);
    expect(typeof result.amount).toEqual('number');

    // Verify account balance was updated
    const updatedAccount = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.id, account[0].id))
      .execute();

    expect(parseFloat(updatedAccount[0].balance)).toEqual(799.50);
  });

  it('should create a transfer transaction and update both account balances', async () => {
    // Create source account
    const sourceAccount = await db.insert(accountsTable)
      .values({
        user_id: testUserId,
        name: 'Checking Account',
        account_type: 'checking',
        balance: '1000.00',
        initial_balance: '1000.00'
      })
      .returning()
      .execute();

    // Create destination account
    const destinationAccount = await db.insert(accountsTable)
      .values({
        user_id: testUserId,
        name: 'Savings Account',
        account_type: 'savings',
        balance: '500.00',
        initial_balance: '500.00'
      })
      .returning()
      .execute();

    const input: CreateTransactionInput = {
      account_id: sourceAccount[0].id,
      to_account_id: destinationAccount[0].id,
      transaction_type: 'transfer',
      amount: 300.00,
      description: 'Transfer to savings',
      transaction_date: new Date(),
      tags: ['transfer']
    };

    const result = await createTransaction(input, testUserId);

    // Verify transaction fields
    expect(result.transaction_type).toEqual('transfer');
    expect(result.to_account_id).toEqual(destinationAccount[0].id);
    expect(result.amount).toEqual(300.00);
    expect(result.category_id).toBeNull();

    // Verify both account balances were updated
    const updatedSourceAccount = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.id, sourceAccount[0].id))
      .execute();

    const updatedDestinationAccount = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.id, destinationAccount[0].id))
      .execute();

    expect(parseFloat(updatedSourceAccount[0].balance)).toEqual(700.00);
    expect(parseFloat(updatedDestinationAccount[0].balance)).toEqual(800.00);
  });

  it('should save transaction to database', async () => {
    // Create test account
    const account = await db.insert(accountsTable)
      .values({
        user_id: testUserId,
        name: 'Test Account',
        account_type: 'checking',
        balance: '1000.00',
        initial_balance: '1000.00'
      })
      .returning()
      .execute();

    const input: CreateTransactionInput = {
      account_id: account[0].id,
      transaction_type: 'expense',
      amount: 100.00,
      description: 'Test transaction',
      transaction_date: new Date(),
      tags: ['test']
    };

    const result = await createTransaction(input, testUserId);

    // Query database to verify transaction was saved
    const transactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, result.id))
      .execute();

    expect(transactions).toHaveLength(1);
    expect(transactions[0].description).toEqual('Test transaction');
    expect(parseFloat(transactions[0].amount)).toEqual(100.00);
    expect(transactions[0].transaction_type).toEqual('expense');
  });

  it('should throw error if source account not found', async () => {
    const input: CreateTransactionInput = {
      account_id: '550e8400-e29b-41d4-a716-446655440999',
      transaction_type: 'expense',
      amount: 100.00,
      description: 'Test transaction',
      transaction_date: new Date(),
      tags: []
    };

    expect(createTransaction(input, testUserId))
      .rejects.toThrow(/source account not found/i);
  });

  it('should throw error if destination account not found for transfer', async () => {
    // Create source account
    const account = await db.insert(accountsTable)
      .values({
        user_id: testUserId,
        name: 'Test Account',
        account_type: 'checking',
        balance: '1000.00',
        initial_balance: '1000.00'
      })
      .returning()
      .execute();

    const input: CreateTransactionInput = {
      account_id: account[0].id,
      to_account_id: '550e8400-e29b-41d4-a716-446655440999',
      transaction_type: 'transfer',
      amount: 100.00,
      description: 'Test transfer',
      transaction_date: new Date(),
      tags: []
    };

    expect(createTransaction(input, testUserId))
      .rejects.toThrow(/destination account not found/i);
  });

  it('should throw error if transfer has no destination account', async () => {
    // Create source account
    const account = await db.insert(accountsTable)
      .values({
        user_id: testUserId,
        name: 'Test Account',
        account_type: 'checking',
        balance: '1000.00',
        initial_balance: '1000.00'
      })
      .returning()
      .execute();

    const input: CreateTransactionInput = {
      account_id: account[0].id,
      transaction_type: 'transfer',
      amount: 100.00,
      description: 'Test transfer',
      transaction_date: new Date(),
      tags: []
    };

    expect(createTransaction(input, testUserId))
      .rejects.toThrow(/destination account is required/i);
  });

  it('should throw error if source and destination accounts are the same', async () => {
    // Create account
    const account = await db.insert(accountsTable)
      .values({
        user_id: testUserId,
        name: 'Test Account',
        account_type: 'checking',
        balance: '1000.00',
        initial_balance: '1000.00'
      })
      .returning()
      .execute();

    const input: CreateTransactionInput = {
      account_id: account[0].id,
      to_account_id: account[0].id,
      transaction_type: 'transfer',
      amount: 100.00,
      description: 'Invalid transfer',
      transaction_date: new Date(),
      tags: []
    };

    expect(createTransaction(input, testUserId))
      .rejects.toThrow(/source and destination accounts cannot be the same/i);
  });

  it('should throw error if category not found', async () => {
    // Create test account
    const account = await db.insert(accountsTable)
      .values({
        user_id: testUserId,
        name: 'Test Account',
        account_type: 'checking',
        balance: '1000.00',
        initial_balance: '1000.00'
      })
      .returning()
      .execute();

    const input: CreateTransactionInput = {
      account_id: account[0].id,
      category_id: '550e8400-e29b-41d4-a716-446655440999',
      transaction_type: 'expense',
      amount: 100.00,
      description: 'Test transaction',
      transaction_date: new Date(),
      tags: []
    };

    expect(createTransaction(input, testUserId))
      .rejects.toThrow(/category not found/i);
  });

  it('should throw error if category type does not match transaction type', async () => {
    // Create test account
    const account = await db.insert(accountsTable)
      .values({
        user_id: testUserId,
        name: 'Test Account',
        account_type: 'checking',
        balance: '1000.00',
        initial_balance: '1000.00'
      })
      .returning()
      .execute();

    // Create income category
    const category = await db.insert(categoriesTable)
      .values({
        user_id: testUserId,
        name: 'Salary',
        category_type: 'income'
      })
      .returning()
      .execute();

    const input: CreateTransactionInput = {
      account_id: account[0].id,
      category_id: category[0].id,
      transaction_type: 'expense', // Mismatched type
      amount: 100.00,
      description: 'Test transaction',
      transaction_date: new Date(),
      tags: []
    };

    expect(createTransaction(input, testUserId))
      .rejects.toThrow(/category type must be expense/i);
  });
});