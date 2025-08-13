import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { profilesTable, accountsTable, categoriesTable, transactionsTable } from '../db/schema';
import { deleteTransaction } from '../handlers/delete_transaction';
import { eq, and, isNull } from 'drizzle-orm';

const testUserId = '123e4567-e89b-12d3-a456-426614174000';
const testAccountId = '223e4567-e89b-12d3-a456-426614174001';
const testToAccountId = '323e4567-e89b-12d3-a456-426614174002';
const testCategoryId = '423e4567-e89b-12d3-a456-426614174003';

describe('deleteTransaction', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  beforeEach(async () => {
    // Create test user profile
    await db.insert(profilesTable).values({
      id: '523e4567-e89b-12d3-a456-426614174004',
      user_id: testUserId,
      display_name: 'Test User',
      email: 'test@example.com',
      currency: 'IDR',
      locale: 'id-ID',
      timezone: 'Asia/Jakarta'
    }).execute();

    // Create test accounts
    await db.insert(accountsTable).values([
      {
        id: testAccountId,
        user_id: testUserId,
        name: 'Test Account',
        account_type: 'checking',
        balance: '1000.00',
        initial_balance: '500.00'
      },
      {
        id: testToAccountId,
        user_id: testUserId,
        name: 'Target Account',
        account_type: 'savings',
        balance: '2000.00',
        initial_balance: '1500.00'
      }
    ]).execute();

    // Create test category
    await db.insert(categoriesTable).values({
      id: testCategoryId,
      user_id: testUserId,
      name: 'Test Category',
      category_type: 'expense'
    }).execute();
  });

  it('should soft delete an income transaction and reverse account balance', async () => {
    // Create income transaction
    const transactionResult = await db.insert(transactionsTable).values({
      id: '623e4567-e89b-12d3-a456-426614174005',
      user_id: testUserId,
      account_id: testAccountId,
      category_id: testCategoryId,
      transaction_type: 'income',
      amount: '100.50',
      description: 'Test income',
      transaction_date: new Date()
    }).returning().execute();

    const transaction = transactionResult[0];

    // Update account balance to reflect the income
    await db.update(accountsTable)
      .set({ balance: '1100.50' }) // 1000 + 100.50
      .where(eq(accountsTable.id, testAccountId))
      .execute();

    // Delete the transaction
    const result = await deleteTransaction(transaction.id, testUserId);

    expect(result.success).toBe(true);

    // Check transaction is soft deleted
    const deletedTransactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, transaction.id))
      .execute();

    expect(deletedTransactions[0].deleted_at).toBeInstanceOf(Date);

    // Check account balance was reversed (should be back to 1000.00)
    const accounts = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.id, testAccountId))
      .execute();

    expect(parseFloat(accounts[0].balance)).toBe(1000.00);
  });

  it('should soft delete an expense transaction and reverse account balance', async () => {
    // Create expense transaction
    const transactionResult = await db.insert(transactionsTable).values({
      id: '723e4567-e89b-12d3-a456-426614174006',
      user_id: testUserId,
      account_id: testAccountId,
      category_id: testCategoryId,
      transaction_type: 'expense',
      amount: '75.25',
      description: 'Test expense',
      transaction_date: new Date()
    }).returning().execute();

    const transaction = transactionResult[0];

    // Update account balance to reflect the expense
    await db.update(accountsTable)
      .set({ balance: '924.75' }) // 1000 - 75.25
      .where(eq(accountsTable.id, testAccountId))
      .execute();

    // Delete the transaction
    const result = await deleteTransaction(transaction.id, testUserId);

    expect(result.success).toBe(true);

    // Check transaction is soft deleted
    const deletedTransactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, transaction.id))
      .execute();

    expect(deletedTransactions[0].deleted_at).toBeInstanceOf(Date);

    // Check account balance was reversed (should be back to 1000.00)
    const accounts = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.id, testAccountId))
      .execute();

    expect(parseFloat(accounts[0].balance)).toBe(1000.00);
  });

  it('should soft delete a transfer transaction and reverse both account balances', async () => {
    // Create transfer transaction
    const transactionResult = await db.insert(transactionsTable).values({
      id: '823e4567-e89b-12d3-a456-426614174007',
      user_id: testUserId,
      account_id: testAccountId,
      to_account_id: testToAccountId,
      transaction_type: 'transfer',
      amount: '250.00',
      description: 'Test transfer',
      transaction_date: new Date()
    }).returning().execute();

    const transaction = transactionResult[0];

    // Update both account balances to reflect the transfer
    await db.update(accountsTable)
      .set({ balance: '750.00' }) // 1000 - 250
      .where(eq(accountsTable.id, testAccountId))
      .execute();

    await db.update(accountsTable)
      .set({ balance: '2250.00' }) // 2000 + 250
      .where(eq(accountsTable.id, testToAccountId))
      .execute();

    // Delete the transaction
    const result = await deleteTransaction(transaction.id, testUserId);

    expect(result.success).toBe(true);

    // Check transaction is soft deleted
    const deletedTransactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, transaction.id))
      .execute();

    expect(deletedTransactions[0].deleted_at).toBeInstanceOf(Date);

    // Check both account balances were reversed
    const sourceAccounts = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.id, testAccountId))
      .execute();

    const destAccounts = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.id, testToAccountId))
      .execute();

    expect(parseFloat(sourceAccounts[0].balance)).toBe(1000.00);
    expect(parseFloat(destAccounts[0].balance)).toBe(2000.00);
  });

  it('should throw error when transaction is not found', async () => {
    const nonExistentId = '923e4567-e89b-12d3-a456-426614174008';

    await expect(deleteTransaction(nonExistentId, testUserId))
      .rejects.toThrow(/transaction not found/i);
  });

  it('should throw error when transaction belongs to different user', async () => {
    // Create transaction for test user
    const transactionResult = await db.insert(transactionsTable).values({
      id: 'a23e4567-e89b-12d3-a456-426614174009',
      user_id: testUserId,
      account_id: testAccountId,
      category_id: testCategoryId,
      transaction_type: 'expense',
      amount: '50.00',
      description: 'Test transaction',
      transaction_date: new Date()
    }).returning().execute();

    const transaction = transactionResult[0];
    const differentUserId = 'b23e4567-e89b-12d3-a456-426614174010';

    await expect(deleteTransaction(transaction.id, differentUserId))
      .rejects.toThrow(/transaction not found/i);
  });

  it('should throw error when transaction is already deleted', async () => {
    // Create and immediately soft delete transaction
    const transactionResult = await db.insert(transactionsTable).values({
      id: 'c23e4567-e89b-12d3-a456-426614174011',
      user_id: testUserId,
      account_id: testAccountId,
      category_id: testCategoryId,
      transaction_type: 'expense',
      amount: '30.00',
      description: 'Already deleted transaction',
      transaction_date: new Date(),
      deleted_at: new Date()
    }).returning().execute();

    const transaction = transactionResult[0];

    await expect(deleteTransaction(transaction.id, testUserId))
      .rejects.toThrow(/transaction not found/i);
  });

  it('should verify transaction remains queryable by id but marked as deleted', async () => {
    // Create transaction
    const transactionResult = await db.insert(transactionsTable).values({
      id: 'd23e4567-e89b-12d3-a456-426614174012',
      user_id: testUserId,
      account_id: testAccountId,
      category_id: testCategoryId,
      transaction_type: 'income',
      amount: '200.00',
      description: 'Verification transaction',
      transaction_date: new Date()
    }).returning().execute();

    const transaction = transactionResult[0];

    // Delete the transaction
    await deleteTransaction(transaction.id, testUserId);

    // Verify transaction still exists in database but with deleted_at timestamp
    const allTransactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, transaction.id))
      .execute();

    expect(allTransactions).toHaveLength(1);
    expect(allTransactions[0].deleted_at).toBeInstanceOf(Date);
    expect(allTransactions[0].updated_at).toBeInstanceOf(Date);

    // Verify it's not returned by active transaction queries
    const activeTransactions = await db.select()
      .from(transactionsTable)
      .where(and(
        eq(transactionsTable.id, transaction.id),
        isNull(transactionsTable.deleted_at)
      ))
      .execute();

    expect(activeTransactions).toHaveLength(0);
  });

  it('should handle decimal amounts correctly during balance reversal', async () => {
    // Create transaction with complex decimal amount
    const transactionResult = await db.insert(transactionsTable).values({
      id: 'e23e4567-e89b-12d3-a456-426614174013',
      user_id: testUserId,
      account_id: testAccountId,
      category_id: testCategoryId,
      transaction_type: 'expense',
      amount: '123.45',
      description: 'Decimal amount test',
      transaction_date: new Date()
    }).returning().execute();

    const transaction = transactionResult[0];

    // Update account balance to reflect the expense
    await db.update(accountsTable)
      .set({ balance: '876.55' }) // 1000.00 - 123.45
      .where(eq(accountsTable.id, testAccountId))
      .execute();

    // Delete the transaction
    const result = await deleteTransaction(transaction.id, testUserId);

    expect(result.success).toBe(true);

    // Check account balance precision
    const accounts = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.id, testAccountId))
      .execute();

    expect(parseFloat(accounts[0].balance)).toBe(1000.00);
  });
});