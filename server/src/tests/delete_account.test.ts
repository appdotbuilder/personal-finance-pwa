import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  accountsTable, 
  transactionsTable, 
  recurringRulesTable, 
  savingsGoalsTable,
  categoriesTable
} from '../db/schema';
import { deleteAccount } from '../handlers/delete_account';
import { eq, and, isNull } from 'drizzle-orm';

const testUserId = '550e8400-e29b-41d4-a716-446655440000';
const testAccountId = '550e8400-e29b-41d4-a716-446655440001';
const otherUserId = '550e8400-e29b-41d4-a716-446655440002';
const testCategoryId = '550e8400-e29b-41d4-a716-446655440003';

describe('deleteAccount', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  const createTestAccount = async (userId: string = testUserId, accountId: string = testAccountId) => {
    await db.insert(accountsTable).values({
      id: accountId,
      user_id: userId,
      name: 'Test Account',
      account_type: 'checking',
      balance: '1000.00',
      initial_balance: '1000.00',
      currency: 'IDR'
    }).execute();
  };

  const createTestCategory = async (userId: string = testUserId) => {
    await db.insert(categoriesTable).values({
      id: testCategoryId,
      user_id: userId,
      name: 'Test Category',
      category_type: 'expense'
    }).execute();
  };

  it('should successfully delete an empty account', async () => {
    await createTestAccount();

    const result = await deleteAccount(testAccountId, testUserId);

    expect(result.success).toBe(true);

    // Verify account is soft deleted
    const accounts = await db.select()
      .from(accountsTable)
      .where(
        and(
          eq(accountsTable.id, testAccountId),
          isNull(accountsTable.deleted_at)
        )
      )
      .execute();

    expect(accounts).toHaveLength(0);

    // Verify account still exists but is deleted
    const deletedAccounts = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.id, testAccountId))
      .execute();

    expect(deletedAccounts).toHaveLength(1);
    expect(deletedAccounts[0].deleted_at).toBeInstanceOf(Date);
    expect(deletedAccounts[0].updated_at).toBeInstanceOf(Date);
  });

  it('should throw error for non-existent account', async () => {
    const nonExistentId = '550e8400-e29b-41d4-a716-446655440099';

    await expect(deleteAccount(nonExistentId, testUserId))
      .rejects
      .toThrow(/Account not found or access denied/i);
  });

  it('should throw error when user does not own the account', async () => {
    await createTestAccount();

    await expect(deleteAccount(testAccountId, otherUserId))
      .rejects
      .toThrow(/Account not found or access denied/i);
  });

  it('should throw error when account is already deleted', async () => {
    // Create account and then soft delete it
    await createTestAccount();
    await db.update(accountsTable)
      .set({ deleted_at: new Date() })
      .where(eq(accountsTable.id, testAccountId))
      .execute();

    await expect(deleteAccount(testAccountId, testUserId))
      .rejects
      .toThrow(/Account not found or access denied/i);
  });

  it('should throw error when account has transactions', async () => {
    await createTestAccount();
    await createTestCategory();

    // Create a transaction for this account
    await db.insert(transactionsTable).values({
      user_id: testUserId,
      account_id: testAccountId,
      category_id: testCategoryId,
      transaction_type: 'expense',
      amount: '50.00',
      description: 'Test expense',
      transaction_date: new Date()
    }).execute();

    await expect(deleteAccount(testAccountId, testUserId))
      .rejects
      .toThrow(/Cannot delete account with existing transactions/i);
  });

  it('should throw error when account is target of transfer transactions', async () => {
    await createTestAccount();
    
    // Create another account for the transfer source
    const sourceAccountId = '550e8400-e29b-41d4-a716-446655440004';
    await createTestAccount(testUserId, sourceAccountId);

    // Create a transfer transaction TO our test account
    await db.insert(transactionsTable).values({
      user_id: testUserId,
      account_id: sourceAccountId,
      to_account_id: testAccountId,
      transaction_type: 'transfer',
      amount: '100.00',
      description: 'Test transfer',
      transaction_date: new Date()
    }).execute();

    await expect(deleteAccount(testAccountId, testUserId))
      .rejects
      .toThrow(/Cannot delete account with existing transfer transactions/i);
  });

  it('should throw error when account has active recurring rules', async () => {
    await createTestAccount();
    await createTestCategory();

    // Create an active recurring rule
    await db.insert(recurringRulesTable).values({
      user_id: testUserId,
      account_id: testAccountId,
      category_id: testCategoryId,
      transaction_type: 'expense',
      amount: '100.00',
      description: 'Monthly expense',
      frequency: 'monthly',
      start_date: new Date(),
      next_occurrence: new Date(),
      is_active: true
    }).execute();

    await expect(deleteAccount(testAccountId, testUserId))
      .rejects
      .toThrow(/Cannot delete account with active recurring rules/i);
  });

  it('should throw error when account is target of active transfer recurring rules', async () => {
    await createTestAccount();
    
    // Create source account
    const sourceAccountId = '550e8400-e29b-41d4-a716-446655440004';
    await createTestAccount(testUserId, sourceAccountId);

    // Create active recurring transfer rule TO our test account
    await db.insert(recurringRulesTable).values({
      user_id: testUserId,
      account_id: sourceAccountId,
      to_account_id: testAccountId,
      transaction_type: 'transfer',
      amount: '500.00',
      description: 'Monthly transfer',
      frequency: 'monthly',
      start_date: new Date(),
      next_occurrence: new Date(),
      is_active: true
    }).execute();

    await expect(deleteAccount(testAccountId, testUserId))
      .rejects
      .toThrow(/Cannot delete account with active transfer recurring rules/i);
  });

  it('should throw error when account has active savings goals', async () => {
    await createTestAccount();

    // Create an active savings goal
    await db.insert(savingsGoalsTable).values({
      user_id: testUserId,
      account_id: testAccountId,
      name: 'Emergency Fund',
      target_amount: '10000.00',
      status: 'active'
    }).execute();

    await expect(deleteAccount(testAccountId, testUserId))
      .rejects
      .toThrow(/Cannot delete account with active savings goals/i);
  });

  it('should allow deletion when recurring rules are inactive', async () => {
    await createTestAccount();
    await createTestCategory();

    // Create an inactive recurring rule
    await db.insert(recurringRulesTable).values({
      user_id: testUserId,
      account_id: testAccountId,
      category_id: testCategoryId,
      transaction_type: 'expense',
      amount: '100.00',
      description: 'Inactive expense',
      frequency: 'monthly',
      start_date: new Date(),
      next_occurrence: new Date(),
      is_active: false
    }).execute();

    const result = await deleteAccount(testAccountId, testUserId);
    expect(result.success).toBe(true);
  });

  it('should allow deletion when savings goals are not active', async () => {
    await createTestAccount();

    // Create completed and paused savings goals
    await db.insert(savingsGoalsTable).values([
      {
        user_id: testUserId,
        account_id: testAccountId,
        name: 'Completed Goal',
        target_amount: '5000.00',
        current_amount: '5000.00',
        status: 'completed'
      },
      {
        user_id: testUserId,
        account_id: testAccountId,
        name: 'Paused Goal',
        target_amount: '8000.00',
        current_amount: '2000.00',
        status: 'paused'
      }
    ]).execute();

    const result = await deleteAccount(testAccountId, testUserId);
    expect(result.success).toBe(true);
  });

  it('should allow deletion when transactions and recurring rules are soft deleted', async () => {
    await createTestAccount();
    await createTestCategory();

    // Create soft-deleted transaction
    await db.insert(transactionsTable).values({
      user_id: testUserId,
      account_id: testAccountId,
      category_id: testCategoryId,
      transaction_type: 'expense',
      amount: '50.00',
      description: 'Deleted expense',
      transaction_date: new Date(),
      deleted_at: new Date()
    }).execute();

    // Create soft-deleted recurring rule
    await db.insert(recurringRulesTable).values({
      user_id: testUserId,
      account_id: testAccountId,
      category_id: testCategoryId,
      transaction_type: 'expense',
      amount: '100.00',
      description: 'Deleted rule',
      frequency: 'monthly',
      start_date: new Date(),
      next_occurrence: new Date(),
      is_active: true,
      deleted_at: new Date()
    }).execute();

    const result = await deleteAccount(testAccountId, testUserId);
    expect(result.success).toBe(true);
  });
});