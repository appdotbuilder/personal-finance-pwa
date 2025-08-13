import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { transactionsTable, accountsTable, categoriesTable, profilesTable } from '../db/schema';
import { type UpdateTransactionInput } from '../schema';
import { updateTransaction } from '../handlers/update_transaction';
import { eq, and } from 'drizzle-orm';

// Test data setup
const testUserId = '550e8400-e29b-41d4-a716-446655440000';
const otherUserId = '550e8400-e29b-41d4-a716-446655440001';

describe('updateTransaction', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update basic transaction fields', async () => {
    // Create user profile
    await db.insert(profilesTable).values({
      user_id: testUserId,
      display_name: 'Test User',
      email: 'test@example.com'
    }).execute();

    // Create test account
    const accountResult = await db.insert(accountsTable).values({
      user_id: testUserId,
      name: 'Test Account',
      account_type: 'checking',
      initial_balance: '1000.00',
      balance: '1000.00'
    }).returning().execute();
    const accountId = accountResult[0].id;

    // Create test category
    const categoryResult = await db.insert(categoriesTable).values({
      user_id: testUserId,
      name: 'Test Category',
      category_type: 'expense'
    }).returning().execute();
    const categoryId = categoryResult[0].id;

    // Create initial transaction
    const transactionResult = await db.insert(transactionsTable).values({
      user_id: testUserId,
      account_id: accountId,
      category_id: categoryId,
      transaction_type: 'expense',
      amount: '100.00',
      description: 'Original description',
      transaction_date: new Date('2024-01-01')
    }).returning().execute();
    const transactionId = transactionResult[0].id;

    // Update transaction
    const updateInput: UpdateTransactionInput = {
      id: transactionId,
      description: 'Updated description',
      amount: 150.00,
      notes: 'Updated notes'
    };

    const result = await updateTransaction(updateInput, testUserId);

    // Verify updated fields
    expect(result.description).toBe('Updated description');
    expect(result.amount).toBe(150.00);
    expect(result.notes).toBe('Updated notes');
    expect(result.id).toBe(transactionId);
    expect(result.updated_at).toBeInstanceOf(Date);

    // Verify transaction is saved to database
    const savedTransaction = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, transactionId))
      .execute();

    expect(savedTransaction).toHaveLength(1);
    expect(savedTransaction[0].description).toBe('Updated description');
    expect(parseFloat(savedTransaction[0].amount)).toBe(150.00);
    expect(savedTransaction[0].notes).toBe('Updated notes');
  });

  it('should update account balances when transaction amount changes', async () => {
    // Create user profile
    await db.insert(profilesTable).values({
      user_id: testUserId,
      display_name: 'Test User',
      email: 'test@example.com'
    }).execute();

    // Create test account with initial balance
    const accountResult = await db.insert(accountsTable).values({
      user_id: testUserId,
      name: 'Test Account',
      account_type: 'checking',
      initial_balance: '1000.00',
      balance: '1000.00' // Starting balance before any transactions
    }).returning().execute();
    const accountId = accountResult[0].id;

    // Create initial expense transaction
    const transactionResult = await db.insert(transactionsTable).values({
      user_id: testUserId,
      account_id: accountId,
      transaction_type: 'expense',
      amount: '100.00',
      description: 'Original expense',
      transaction_date: new Date('2024-01-01')
    }).returning().execute();
    const transactionId = transactionResult[0].id;

    // Manually apply the initial transaction's balance impact (simulate what would happen on creation)
    await db.update(accountsTable)
      .set({ balance: '900.00' }) // 1000 - 100 (expense)
      .where(eq(accountsTable.id, accountId))
      .execute();

    // Update transaction amount to 150
    const updateInput: UpdateTransactionInput = {
      id: transactionId,
      amount: 150.00
    };

    await updateTransaction(updateInput, testUserId);

    // Check updated account balance
    // Should be: 900 (current after first expense) + 100 (revert old) - 150 (apply new) = 850
    const updatedAccount = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.id, accountId))
      .execute();

    expect(parseFloat(updatedAccount[0].balance)).toBe(850.00);
  });

  it('should handle transfer transaction updates correctly', async () => {
    // Create user profile
    await db.insert(profilesTable).values({
      user_id: testUserId,
      display_name: 'Test User',
      email: 'test@example.com'
    }).execute();

    // Create two test accounts
    const sourceAccountResult = await db.insert(accountsTable).values({
      user_id: testUserId,
      name: 'Source Account',
      account_type: 'checking',
      initial_balance: '1000.00',
      balance: '1000.00' // Initial balance
    }).returning().execute();
    const sourceAccountId = sourceAccountResult[0].id;

    const destAccountResult = await db.insert(accountsTable).values({
      user_id: testUserId,
      name: 'Destination Account',
      account_type: 'savings',
      initial_balance: '500.00',
      balance: '500.00' // Initial balance
    }).returning().execute();
    const destAccountId = destAccountResult[0].id;

    // Create initial transfer transaction
    const transactionResult = await db.insert(transactionsTable).values({
      user_id: testUserId,
      account_id: sourceAccountId,
      to_account_id: destAccountId,
      transaction_type: 'transfer',
      amount: '100.00',
      description: 'Original transfer',
      transaction_date: new Date('2024-01-01')
    }).returning().execute();
    const transactionId = transactionResult[0].id;

    // Manually apply the initial transfer's balance impact
    await db.update(accountsTable)
      .set({ balance: '900.00' }) // 1000 - 100 (transfer out)
      .where(eq(accountsTable.id, sourceAccountId))
      .execute();

    await db.update(accountsTable)
      .set({ balance: '600.00' }) // 500 + 100 (transfer in)
      .where(eq(accountsTable.id, destAccountId))
      .execute();

    // Update transfer amount to 200
    const updateInput: UpdateTransactionInput = {
      id: transactionId,
      amount: 200.00
    };

    await updateTransaction(updateInput, testUserId);

    // Check updated account balances
    const updatedSourceAccount = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.id, sourceAccountId))
      .execute();

    const updatedDestAccount = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.id, destAccountId))
      .execute();

    // Source: 900 (current after first transfer) + 100 (revert) - 200 (apply new) = 800
    expect(parseFloat(updatedSourceAccount[0].balance)).toBe(800.00);
    // Dest: 600 (current after first transfer) - 100 (revert) + 200 (apply new) = 700
    expect(parseFloat(updatedDestAccount[0].balance)).toBe(700.00);
  });

  it('should change transaction type and adjust balances accordingly', async () => {
    // Create user profile
    await db.insert(profilesTable).values({
      user_id: testUserId,
      display_name: 'Test User',
      email: 'test@example.com'
    }).execute();

    // Create test account
    const accountResult = await db.insert(accountsTable).values({
      user_id: testUserId,
      name: 'Test Account',
      account_type: 'checking',
      initial_balance: '1000.00',
      balance: '1000.00' // Initial balance
    }).returning().execute();
    const accountId = accountResult[0].id;

    // Create initial expense transaction
    const transactionResult = await db.insert(transactionsTable).values({
      user_id: testUserId,
      account_id: accountId,
      transaction_type: 'expense',
      amount: '100.00',
      description: 'Original expense',
      transaction_date: new Date('2024-01-01')
    }).returning().execute();
    const transactionId = transactionResult[0].id;

    // Manually apply the initial expense's balance impact
    await db.update(accountsTable)
      .set({ balance: '900.00' }) // 1000 - 100 (expense)
      .where(eq(accountsTable.id, accountId))
      .execute();

    // Update transaction type to income
    const updateInput: UpdateTransactionInput = {
      id: transactionId,
      transaction_type: 'income'
    };

    await updateTransaction(updateInput, testUserId);

    // Check updated account balance
    // Should be: 900 (current) + 100 (revert expense) + 100 (apply income) = 1100
    const updatedAccount = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.id, accountId))
      .execute();

    expect(parseFloat(updatedAccount[0].balance)).toBe(1100.00);
  });

  it('should validate transaction ownership', async () => {
    // Create user profile for first user
    await db.insert(profilesTable).values({
      user_id: testUserId,
      display_name: 'Test User',
      email: 'test@example.com'
    }).execute();

    // Create account for first user
    const accountResult = await db.insert(accountsTable).values({
      user_id: testUserId,
      name: 'Test Account',
      account_type: 'checking',
      initial_balance: '1000.00',
      balance: '1000.00'
    }).returning().execute();
    const accountId = accountResult[0].id;

    // Create transaction for first user
    const transactionResult = await db.insert(transactionsTable).values({
      user_id: testUserId,
      account_id: accountId,
      transaction_type: 'expense',
      amount: '100.00',
      description: 'Test transaction',
      transaction_date: new Date('2024-01-01')
    }).returning().execute();
    const transactionId = transactionResult[0].id;

    // Try to update with different user
    const updateInput: UpdateTransactionInput = {
      id: transactionId,
      description: 'Hacked description'
    };

    await expect(updateTransaction(updateInput, otherUserId))
      .rejects.toThrow(/not found or access denied/i);
  });

  it('should validate account ownership when changing account', async () => {
    // Create user profiles
    await db.insert(profilesTable).values([
      {
        user_id: testUserId,
        display_name: 'Test User',
        email: 'test@example.com'
      },
      {
        user_id: otherUserId,
        display_name: 'Other User',
        email: 'other@example.com'
      }
    ]).execute();

    // Create accounts for both users
    const userAccountResult = await db.insert(accountsTable).values({
      user_id: testUserId,
      name: 'User Account',
      account_type: 'checking',
      initial_balance: '1000.00',
      balance: '1000.00'
    }).returning().execute();
    const userAccountId = userAccountResult[0].id;

    const otherAccountResult = await db.insert(accountsTable).values({
      user_id: otherUserId,
      name: 'Other Account',
      account_type: 'checking',
      initial_balance: '1000.00',
      balance: '1000.00'
    }).returning().execute();
    const otherAccountId = otherAccountResult[0].id;

    // Create transaction for first user
    const transactionResult = await db.insert(transactionsTable).values({
      user_id: testUserId,
      account_id: userAccountId,
      transaction_type: 'expense',
      amount: '100.00',
      description: 'Test transaction',
      transaction_date: new Date('2024-01-01')
    }).returning().execute();
    const transactionId = transactionResult[0].id;

    // Try to change to other user's account
    const updateInput: UpdateTransactionInput = {
      id: transactionId,
      account_id: otherAccountId
    };

    await expect(updateTransaction(updateInput, testUserId))
      .rejects.toThrow(/Account not found or access denied/i);
  });

  it('should handle partial updates correctly', async () => {
    // Create user profile
    await db.insert(profilesTable).values({
      user_id: testUserId,
      display_name: 'Test User',
      email: 'test@example.com'
    }).execute();

    // Create test account
    const accountResult = await db.insert(accountsTable).values({
      user_id: testUserId,
      name: 'Test Account',
      account_type: 'checking',
      initial_balance: '1000.00',
      balance: '1000.00'
    }).returning().execute();
    const accountId = accountResult[0].id;

    // Create initial transaction
    const transactionResult = await db.insert(transactionsTable).values({
      user_id: testUserId,
      account_id: accountId,
      transaction_type: 'income',
      amount: '500.00',
      description: 'Original description',
      notes: 'Original notes',
      transaction_date: new Date('2024-01-01'),
      tags: ['tag1', 'tag2']
    }).returning().execute();
    const transactionId = transactionResult[0].id;

    // Update only description
    const updateInput: UpdateTransactionInput = {
      id: transactionId,
      description: 'Updated description only'
    };

    const result = await updateTransaction(updateInput, testUserId);

    // Verify only description changed
    expect(result.description).toBe('Updated description only');
    expect(result.amount).toBe(500.00);
    expect(result.notes).toBe('Original notes');
    expect(result.tags).toEqual(['tag1', 'tag2']);
    expect(result.transaction_type).toBe('income');
  });
});