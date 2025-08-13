import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { profilesTable, accountsTable, categoriesTable, recurringRulesTable } from '../db/schema';
import { getRecurringRules } from '../handlers/get_recurring_rules';

const testUserId = '123e4567-e89b-12d3-a456-426614174000';
const otherUserId = '223e4567-e89b-12d3-a456-426614174001';

describe('getRecurringRules', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  async function createTestData() {
    // Create test profile
    await db.insert(profilesTable).values({
      user_id: testUserId,
      display_name: 'Test User',
      email: 'test@example.com'
    }).execute();

    // Create test account
    const [account] = await db.insert(accountsTable).values({
      user_id: testUserId,
      name: 'Test Account',
      account_type: 'checking',
      initial_balance: '1000.00'
    }).returning().execute();

    // Create transfer account
    const [transferAccount] = await db.insert(accountsTable).values({
      user_id: testUserId,
      name: 'Savings Account',
      account_type: 'savings',
      initial_balance: '500.00'
    }).returning().execute();

    // Create test category
    const [category] = await db.insert(categoriesTable).values({
      user_id: testUserId,
      name: 'Groceries',
      category_type: 'expense'
    }).returning().execute();

    return { account, transferAccount, category };
  }

  it('should return empty array when no recurring rules exist', async () => {
    await createTestData();

    const result = await getRecurringRules(testUserId);

    expect(result).toEqual([]);
  });

  it('should return active recurring rules for user', async () => {
    const { account, category } = await createTestData();

    // Create active recurring rule
    await db.insert(recurringRulesTable).values({
      user_id: testUserId,
      account_id: account.id,
      category_id: category.id,
      transaction_type: 'expense',
      amount: '50.00',
      description: 'Weekly groceries',
      frequency: 'weekly',
      interval_count: 1,
      start_date: new Date('2024-01-01'),
      next_occurrence: new Date('2024-01-08'),
      is_active: true
    }).execute();

    const result = await getRecurringRules(testUserId);

    expect(result).toHaveLength(1);
    expect(result[0].user_id).toEqual(testUserId);
    expect(result[0].account_id).toEqual(account.id);
    expect(result[0].category_id).toEqual(category.id);
    expect(result[0].transaction_type).toEqual('expense');
    expect(result[0].amount).toEqual(50.00);
    expect(typeof result[0].amount).toEqual('number');
    expect(result[0].description).toEqual('Weekly groceries');
    expect(result[0].frequency).toEqual('weekly');
    expect(result[0].interval_count).toEqual(1);
    expect(result[0].is_active).toEqual(true);
    expect(result[0].deleted_at).toBeNull();
  });

  it('should return multiple recurring rules', async () => {
    const { account, transferAccount, category } = await createTestData();

    // Create multiple recurring rules
    await db.insert(recurringRulesTable).values([
      {
        user_id: testUserId,
        account_id: account.id,
        category_id: category.id,
        transaction_type: 'expense',
        amount: '50.00',
        description: 'Weekly groceries',
        frequency: 'weekly',
        start_date: new Date('2024-01-01'),
        next_occurrence: new Date('2024-01-08'),
        is_active: true
      },
      {
        user_id: testUserId,
        account_id: account.id,
        to_account_id: transferAccount.id,
        transaction_type: 'transfer',
        amount: '200.00',
        description: 'Monthly savings transfer',
        frequency: 'monthly',
        start_date: new Date('2024-01-01'),
        next_occurrence: new Date('2024-02-01'),
        is_active: true
      }
    ]).execute();

    const result = await getRecurringRules(testUserId);

    expect(result).toHaveLength(2);
    
    const expenseRule = result.find(r => r.transaction_type === 'expense');
    const transferRule = result.find(r => r.transaction_type === 'transfer');
    
    expect(expenseRule).toBeDefined();
    expect(expenseRule!.amount).toEqual(50.00);
    expect(expenseRule!.frequency).toEqual('weekly');
    
    expect(transferRule).toBeDefined();
    expect(transferRule!.amount).toEqual(200.00);
    expect(transferRule!.frequency).toEqual('monthly');
    expect(transferRule!.to_account_id).toEqual(transferAccount.id);
  });

  it('should not return inactive recurring rules', async () => {
    const { account, category } = await createTestData();

    // Create inactive recurring rule
    await db.insert(recurringRulesTable).values({
      user_id: testUserId,
      account_id: account.id,
      category_id: category.id,
      transaction_type: 'expense',
      amount: '30.00',
      description: 'Inactive rule',
      frequency: 'monthly',
      start_date: new Date('2024-01-01'),
      next_occurrence: new Date('2024-02-01'),
      is_active: false
    }).execute();

    const result = await getRecurringRules(testUserId);

    expect(result).toHaveLength(0);
  });

  it('should not return soft-deleted recurring rules', async () => {
    const { account, category } = await createTestData();

    // Create soft-deleted recurring rule
    await db.insert(recurringRulesTable).values({
      user_id: testUserId,
      account_id: account.id,
      category_id: category.id,
      transaction_type: 'expense',
      amount: '25.00',
      description: 'Deleted rule',
      frequency: 'monthly',
      start_date: new Date('2024-01-01'),
      next_occurrence: new Date('2024-02-01'),
      is_active: true,
      deleted_at: new Date()
    }).execute();

    const result = await getRecurringRules(testUserId);

    expect(result).toHaveLength(0);
  });

  it('should not return recurring rules from other users', async () => {
    const { account, category } = await createTestData();

    // Create profile and account for other user
    await db.insert(profilesTable).values({
      user_id: otherUserId,
      display_name: 'Other User',
      email: 'other@example.com'
    }).execute();

    const [otherAccount] = await db.insert(accountsTable).values({
      user_id: otherUserId,
      name: 'Other Account',
      account_type: 'checking',
      initial_balance: '500.00'
    }).returning().execute();

    const [otherCategory] = await db.insert(categoriesTable).values({
      user_id: otherUserId,
      name: 'Other Category',
      category_type: 'expense'
    }).returning().execute();

    // Create recurring rules for both users
    await db.insert(recurringRulesTable).values([
      {
        user_id: testUserId,
        account_id: account.id,
        category_id: category.id,
        transaction_type: 'expense',
        amount: '50.00',
        description: 'Test user rule',
        frequency: 'weekly',
        start_date: new Date('2024-01-01'),
        next_occurrence: new Date('2024-01-08'),
        is_active: true
      },
      {
        user_id: otherUserId,
        account_id: otherAccount.id,
        category_id: otherCategory.id,
        transaction_type: 'expense',
        amount: '75.00',
        description: 'Other user rule',
        frequency: 'monthly',
        start_date: new Date('2024-01-01'),
        next_occurrence: new Date('2024-02-01'),
        is_active: true
      }
    ]).execute();

    const result = await getRecurringRules(testUserId);

    expect(result).toHaveLength(1);
    expect(result[0].user_id).toEqual(testUserId);
    expect(result[0].description).toEqual('Test user rule');
    expect(result[0].amount).toEqual(50.00);
  });

  it('should handle different transaction types correctly', async () => {
    const { account, transferAccount, category } = await createTestData();

    // Create recurring rules for different transaction types
    await db.insert(recurringRulesTable).values([
      {
        user_id: testUserId,
        account_id: account.id,
        category_id: category.id,
        transaction_type: 'expense',
        amount: '100.00',
        description: 'Monthly expense',
        frequency: 'monthly',
        start_date: new Date('2024-01-01'),
        next_occurrence: new Date('2024-02-01'),
        is_active: true
      },
      {
        user_id: testUserId,
        account_id: account.id,
        category_id: category.id,
        transaction_type: 'income',
        amount: '2000.00',
        description: 'Salary',
        frequency: 'monthly',
        start_date: new Date('2024-01-01'),
        next_occurrence: new Date('2024-02-01'),
        is_active: true
      },
      {
        user_id: testUserId,
        account_id: account.id,
        to_account_id: transferAccount.id,
        transaction_type: 'transfer',
        amount: '300.00',
        description: 'Savings transfer',
        frequency: 'monthly',
        start_date: new Date('2024-01-01'),
        next_occurrence: new Date('2024-02-01'),
        is_active: true
      }
    ]).execute();

    const result = await getRecurringRules(testUserId);

    expect(result).toHaveLength(3);
    
    const expenseRule = result.find(r => r.transaction_type === 'expense');
    const incomeRule = result.find(r => r.transaction_type === 'income');
    const transferRule = result.find(r => r.transaction_type === 'transfer');
    
    expect(expenseRule).toBeDefined();
    expect(expenseRule!.amount).toEqual(100.00);
    expect(expenseRule!.category_id).toEqual(category.id);
    
    expect(incomeRule).toBeDefined();
    expect(incomeRule!.amount).toEqual(2000.00);
    expect(incomeRule!.category_id).toEqual(category.id);
    
    expect(transferRule).toBeDefined();
    expect(transferRule!.amount).toEqual(300.00);
    expect(transferRule!.to_account_id).toEqual(transferAccount.id);
    expect(transferRule!.category_id).toBeNull();
  });

  it('should handle recurring rules without categories (transfers)', async () => {
    const { account, transferAccount } = await createTestData();

    await db.insert(recurringRulesTable).values({
      user_id: testUserId,
      account_id: account.id,
      to_account_id: transferAccount.id,
      category_id: null,
      transaction_type: 'transfer',
      amount: '500.00',
      description: 'Weekly transfer',
      frequency: 'weekly',
      start_date: new Date('2024-01-01'),
      next_occurrence: new Date('2024-01-08'),
      is_active: true
    }).execute();

    const result = await getRecurringRules(testUserId);

    expect(result).toHaveLength(1);
    expect(result[0].transaction_type).toEqual('transfer');
    expect(result[0].category_id).toBeNull();
    expect(result[0].to_account_id).toEqual(transferAccount.id);
    expect(result[0].amount).toEqual(500.00);
  });

  it('should convert numeric amounts to numbers correctly', async () => {
    const { account, category } = await createTestData();

    await db.insert(recurringRulesTable).values({
      user_id: testUserId,
      account_id: account.id,
      category_id: category.id,
      transaction_type: 'expense',
      amount: '123.45',
      description: 'Test amount conversion',
      frequency: 'monthly',
      start_date: new Date('2024-01-01'),
      next_occurrence: new Date('2024-02-01'),
      is_active: true
    }).execute();

    const result = await getRecurringRules(testUserId);

    expect(result).toHaveLength(1);
    expect(result[0].amount).toEqual(123.45);
    expect(typeof result[0].amount).toEqual('number');
  });
});