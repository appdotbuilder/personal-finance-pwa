import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { profilesTable, accountsTable, categoriesTable, recurringRulesTable, transactionsTable } from '../db/schema';
import { applyRecurringTransactions } from '../handlers/apply_recurring_transactions';
import { eq, and } from 'drizzle-orm';

// Test data
const testUserId = '550e8400-e29b-41d4-a716-446655440000';
const testAccountId = '550e8400-e29b-41d4-a716-446655440001';
const testToAccountId = '550e8400-e29b-41d4-a716-446655440002';
const testCategoryId = '550e8400-e29b-41d4-a716-446655440003';

describe('applyRecurringTransactions', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  async function createTestData() {
    // Create profile
    await db.insert(profilesTable).values({
      id: '550e8400-e29b-41d4-a716-446655440010',
      user_id: testUserId,
      display_name: 'Test User',
      email: 'test@example.com'
    }).execute();

    // Create accounts
    await db.insert(accountsTable).values([
      {
        id: testAccountId,
        user_id: testUserId,
        name: 'Test Account',
        account_type: 'checking',
        balance: '1000.00',
        initial_balance: '1000.00'
      },
      {
        id: testToAccountId,
        user_id: testUserId,
        name: 'Savings Account',
        account_type: 'savings',
        balance: '500.00',
        initial_balance: '500.00'
      }
    ]).execute();

    // Create category
    await db.insert(categoriesTable).values({
      id: testCategoryId,
      user_id: testUserId,
      name: 'Test Category',
      category_type: 'expense'
    }).execute();
  }

  it('should process due income recurring transaction', async () => {
    await createTestData();
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Create due recurring rule for income
    await db.insert(recurringRulesTable).values({
      user_id: testUserId,
      account_id: testAccountId,
      category_id: testCategoryId,
      transaction_type: 'income',
      amount: '100.00',
      description: 'Monthly salary',
      frequency: 'monthly',
      interval_count: 1,
      start_date: yesterday,
      next_occurrence: yesterday,
      is_active: true
    }).execute();

    const result = await applyRecurringTransactions();

    expect(result.processed).toBe(1);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].transaction_type).toBe('income');
    expect(result.transactions[0].amount).toBe(100);
    expect(result.transactions[0].description).toBe('Monthly salary');

    // Check transaction was created
    const transactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.user_id, testUserId))
      .execute();
    
    expect(transactions).toHaveLength(1);
    expect(transactions[0].transaction_type).toBe('income');
    expect(parseFloat(transactions[0].amount)).toBe(100);

    // Check account balance was updated
    const updatedAccount = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.id, testAccountId))
      .execute();
    
    expect(parseFloat(updatedAccount[0].balance)).toBe(1100); // 1000 + 100
  });

  it('should process due expense recurring transaction', async () => {
    await createTestData();
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Create due recurring rule for expense
    await db.insert(recurringRulesTable).values({
      user_id: testUserId,
      account_id: testAccountId,
      category_id: testCategoryId,
      transaction_type: 'expense',
      amount: '50.00',
      description: 'Monthly subscription',
      frequency: 'monthly',
      interval_count: 1,
      start_date: yesterday,
      next_occurrence: yesterday,
      is_active: true
    }).execute();

    const result = await applyRecurringTransactions();

    expect(result.processed).toBe(1);
    expect(result.transactions[0].transaction_type).toBe('expense');
    expect(result.transactions[0].amount).toBe(50);

    // Check account balance was updated
    const updatedAccount = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.id, testAccountId))
      .execute();
    
    expect(parseFloat(updatedAccount[0].balance)).toBe(950); // 1000 - 50
  });

  it('should process due transfer recurring transaction', async () => {
    await createTestData();
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Create due recurring rule for transfer
    await db.insert(recurringRulesTable).values({
      user_id: testUserId,
      account_id: testAccountId,
      to_account_id: testToAccountId,
      transaction_type: 'transfer',
      amount: '200.00',
      description: 'Monthly savings transfer',
      frequency: 'monthly',
      interval_count: 1,
      start_date: yesterday,
      next_occurrence: yesterday,
      is_active: true
    }).execute();

    const result = await applyRecurringTransactions();

    expect(result.processed).toBe(1);
    expect(result.transactions[0].transaction_type).toBe('transfer');
    expect(result.transactions[0].amount).toBe(200);
    expect(result.transactions[0].to_account_id).toBe(testToAccountId);

    // Check both account balances were updated
    const [sourceAccount, destAccount] = await Promise.all([
      db.select().from(accountsTable).where(eq(accountsTable.id, testAccountId)).execute(),
      db.select().from(accountsTable).where(eq(accountsTable.id, testToAccountId)).execute()
    ]);
    
    expect(parseFloat(sourceAccount[0].balance)).toBe(800); // 1000 - 200
    expect(parseFloat(destAccount[0].balance)).toBe(700); // 500 + 200
  });

  it('should update next_occurrence correctly for different frequencies', async () => {
    await createTestData();
    
    const baseDate = new Date('2024-01-15');
    
    // Create weekly recurring rule
    const weeklyRuleResult = await db.insert(recurringRulesTable).values({
      user_id: testUserId,
      account_id: testAccountId,
      category_id: testCategoryId,
      transaction_type: 'expense',
      amount: '25.00',
      description: 'Weekly expense',
      frequency: 'weekly',
      interval_count: 2, // Every 2 weeks
      start_date: baseDate,
      next_occurrence: baseDate,
      is_active: true
    }).returning().execute();

    await applyRecurringTransactions();

    // Check next occurrence was updated correctly (should be 2 weeks later)
    const updatedRule = await db.select()
      .from(recurringRulesTable)
      .where(eq(recurringRulesTable.id, weeklyRuleResult[0].id))
      .execute();
    
    const expectedNext = new Date('2024-01-29'); // 15 + 14 days
    expect(updatedRule[0].next_occurrence.toDateString()).toBe(expectedNext.toDateString());
  });

  it('should deactivate rules that pass their end_date', async () => {
    await createTestData();
    
    // Create rule that ends today but was due yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0); // Start of yesterday
    
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999); // End of today
    
    const ruleResult = await db.insert(recurringRulesTable).values({
      user_id: testUserId,
      account_id: testAccountId,
      category_id: testCategoryId,
      transaction_type: 'income',
      amount: '100.00',
      description: 'Soon to expire rule',
      frequency: 'daily',
      interval_count: 2, // Every 2 days - so next occurrence will be tomorrow
      start_date: yesterday,
      end_date: endDate,
      next_occurrence: yesterday, // Due yesterday
      is_active: true
    }).returning().execute();

    await applyRecurringTransactions();

    // Check rule was deactivated (next occurrence would be tomorrow, beyond end date of today)
    const updatedRule = await db.select()
      .from(recurringRulesTable)
      .where(eq(recurringRulesTable.id, ruleResult[0].id))
      .execute();
    

    
    expect(updatedRule[0].is_active).toBe(false);
    
    // Should still have processed the transaction
    const transactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.user_id, testUserId))
      .execute();
    
    expect(transactions).toHaveLength(1);
    expect(parseFloat(transactions[0].amount)).toBe(100);
  });

  it('should filter by user_id when provided', async () => {
    await createTestData();
    
    const otherUserId = '550e8400-e29b-41d4-a716-446655440099';
    
    // Create profile and account for other user
    await db.insert(profilesTable).values({
      id: '550e8400-e29b-41d4-a716-446655440011',
      user_id: otherUserId,
      display_name: 'Other User',
      email: 'other@example.com'
    }).execute();
    
    const otherAccountId = '550e8400-e29b-41d4-a716-446655440098';
    await db.insert(accountsTable).values({
      id: otherAccountId,
      user_id: otherUserId,
      name: 'Other Account',
      account_type: 'checking',
      balance: '500.00',
      initial_balance: '500.00'
    }).execute();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Create due rules for both users
    await db.insert(recurringRulesTable).values([
      {
        user_id: testUserId,
        account_id: testAccountId,
        category_id: testCategoryId,
        transaction_type: 'income',
        amount: '100.00',
        description: 'Test user income',
        frequency: 'monthly',
        interval_count: 1,
        start_date: yesterday,
        next_occurrence: yesterday,
        is_active: true
      },
      {
        user_id: otherUserId,
        account_id: otherAccountId,
        category_id: testCategoryId,
        transaction_type: 'income',
        amount: '200.00',
        description: 'Other user income',
        frequency: 'monthly',
        interval_count: 1,
        start_date: yesterday,
        next_occurrence: yesterday,
        is_active: true
      }
    ]).execute();

    // Process only for test user
    const result = await applyRecurringTransactions(testUserId);

    expect(result.processed).toBe(1);
    expect(result.transactions[0].user_id).toBe(testUserId);
    expect(result.transactions[0].amount).toBe(100);

    // Verify only test user's transaction was created
    const allTransactions = await db.select()
      .from(transactionsTable)
      .execute();
    
    expect(allTransactions).toHaveLength(1);
    expect(allTransactions[0].user_id).toBe(testUserId);
  });

  it('should skip inactive rules', async () => {
    await createTestData();
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Create inactive recurring rule
    await db.insert(recurringRulesTable).values({
      user_id: testUserId,
      account_id: testAccountId,
      category_id: testCategoryId,
      transaction_type: 'income',
      amount: '100.00',
      description: 'Inactive rule',
      frequency: 'monthly',
      interval_count: 1,
      start_date: yesterday,
      next_occurrence: yesterday,
      is_active: false // Inactive
    }).execute();

    const result = await applyRecurringTransactions();

    expect(result.processed).toBe(0);
    expect(result.transactions).toHaveLength(0);

    // Verify no transactions were created
    const transactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.user_id, testUserId))
      .execute();
    
    expect(transactions).toHaveLength(0);
  });

  it('should skip future rules', async () => {
    await createTestData();
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Create future recurring rule
    await db.insert(recurringRulesTable).values({
      user_id: testUserId,
      account_id: testAccountId,
      category_id: testCategoryId,
      transaction_type: 'income',
      amount: '100.00',
      description: 'Future rule',
      frequency: 'monthly',
      interval_count: 1,
      start_date: tomorrow,
      next_occurrence: tomorrow,
      is_active: true
    }).execute();

    const result = await applyRecurringTransactions();

    expect(result.processed).toBe(0);
    expect(result.transactions).toHaveLength(0);
  });

  it('should skip rules already past their end_date', async () => {
    await createTestData();
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    
    // Create rule with end_date already passed
    await db.insert(recurringRulesTable).values({
      user_id: testUserId,
      account_id: testAccountId,
      category_id: testCategoryId,
      transaction_type: 'income',
      amount: '100.00',
      description: 'Already expired rule',
      frequency: 'daily',
      interval_count: 1,
      start_date: twoDaysAgo,
      end_date: twoDaysAgo, // End date is two days ago
      next_occurrence: yesterday,
      is_active: true
    }).execute();

    const result = await applyRecurringTransactions();

    expect(result.processed).toBe(0);
    expect(result.transactions).toHaveLength(0);

    // Verify no transactions were created
    const transactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.user_id, testUserId))
      .execute();
    
    expect(transactions).toHaveLength(0);
  });

  it('should handle multiple due rules for same user', async () => {
    await createTestData();
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Create multiple due recurring rules
    await db.insert(recurringRulesTable).values([
      {
        user_id: testUserId,
        account_id: testAccountId,
        category_id: testCategoryId,
        transaction_type: 'income',
        amount: '100.00',
        description: 'First income',
        frequency: 'monthly',
        interval_count: 1,
        start_date: yesterday,
        next_occurrence: yesterday,
        is_active: true
      },
      {
        user_id: testUserId,
        account_id: testAccountId,
        category_id: testCategoryId,
        transaction_type: 'expense',
        amount: '50.00',
        description: 'First expense',
        frequency: 'weekly',
        interval_count: 1,
        start_date: yesterday,
        next_occurrence: yesterday,
        is_active: true
      }
    ]).execute();

    const result = await applyRecurringTransactions();

    expect(result.processed).toBe(2);
    expect(result.transactions).toHaveLength(2);

    // Check final account balance (1000 + 100 - 50 = 1050)
    const updatedAccount = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.id, testAccountId))
      .execute();
    
    expect(parseFloat(updatedAccount[0].balance)).toBe(1050);
  });
});