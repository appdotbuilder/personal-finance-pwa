import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { profilesTable, accountsTable, categoriesTable, recurringRulesTable } from '../db/schema';
import { type CreateRecurringRuleInput } from '../schema';
import { createRecurringRule } from '../handlers/create_recurring_rule';
import { eq } from 'drizzle-orm';

const testUserId = '550e8400-e29b-41d4-a716-446655440000';

// Test setup data
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
  name: 'Test Checking Account',
  account_type: 'checking' as const,
  balance: '1000.00',
  initial_balance: '1000.00',
  currency: 'IDR'
};

const testTransferAccount = {
  user_id: testUserId,
  name: 'Test Savings Account',
  account_type: 'savings' as const,
  balance: '500.00',
  initial_balance: '500.00',
  currency: 'IDR'
};

const testCategory = {
  user_id: testUserId,
  name: 'Salary',
  category_type: 'income' as const
};

describe('createRecurringRule', () => {
  let accountId: string;
  let transferAccountId: string;
  let categoryId: string;

  beforeEach(async () => {
    await createDB();
    
    // Create prerequisite data
    await db.insert(profilesTable).values(testProfile).execute();
    
    const [account] = await db.insert(accountsTable).values(testAccount).returning().execute();
    accountId = account.id;
    
    const [transferAccount] = await db.insert(accountsTable).values(testTransferAccount).returning().execute();
    transferAccountId = transferAccount.id;
    
    const [category] = await db.insert(categoriesTable).values(testCategory).returning().execute();
    categoryId = category.id;
  });

  afterEach(resetDB);

  it('should create a monthly income recurring rule', async () => {
    const testInput: CreateRecurringRuleInput = {
      account_id: accountId,
      category_id: categoryId,
      transaction_type: 'income',
      amount: 5000000,
      description: 'Monthly Salary',
      frequency: 'monthly',
      interval_count: 1,
      start_date: new Date('2024-01-01'),
      end_date: new Date('2024-12-31')
    };

    const result = await createRecurringRule(testInput, testUserId);

    // Verify basic fields
    expect(result.id).toBeDefined();
    expect(result.user_id).toEqual(testUserId);
    expect(result.account_id).toEqual(accountId);
    expect(result.category_id).toEqual(categoryId);
    expect(result.transaction_type).toEqual('income');
    expect(result.amount).toEqual(5000000);
    expect(result.description).toEqual('Monthly Salary');
    expect(result.frequency).toEqual('monthly');
    expect(result.interval_count).toEqual(1);
    expect(result.start_date).toEqual(new Date('2024-01-01'));
    expect(result.end_date).toEqual(new Date('2024-12-31'));
    expect(result.is_active).toEqual(true);
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.deleted_at).toBeNull();

    // Verify next occurrence calculation (should be February 1, 2024)
    expect(result.next_occurrence).toEqual(new Date('2024-02-01'));
  });

  it('should create a weekly expense recurring rule', async () => {
    const testInput: CreateRecurringRuleInput = {
      account_id: accountId,
      category_id: categoryId,
      transaction_type: 'expense',
      amount: 100000,
      description: 'Weekly Groceries',
      frequency: 'weekly',
      interval_count: 1,
      start_date: new Date('2024-01-01')
    };

    const result = await createRecurringRule(testInput, testUserId);

    expect(result.transaction_type).toEqual('expense');
    expect(result.amount).toEqual(100000);
    expect(result.frequency).toEqual('weekly');
    expect(result.end_date).toBeNull();

    // Verify next occurrence calculation (should be January 8, 2024)
    expect(result.next_occurrence).toEqual(new Date('2024-01-08'));
  });

  it('should create a transfer recurring rule', async () => {
    const testInput: CreateRecurringRuleInput = {
      account_id: accountId,
      to_account_id: transferAccountId,
      transaction_type: 'transfer',
      amount: 500000,
      description: 'Monthly Savings Transfer',
      frequency: 'monthly',
      interval_count: 1,
      start_date: new Date('2024-01-15')
    };

    const result = await createRecurringRule(testInput, testUserId);

    expect(result.transaction_type).toEqual('transfer');
    expect(result.to_account_id).toEqual(transferAccountId);
    expect(result.category_id).toBeNull();
    expect(result.amount).toEqual(500000);

    // Verify next occurrence calculation (should be February 15, 2024)
    expect(result.next_occurrence).toEqual(new Date('2024-02-15'));
  });

  it('should handle different frequency intervals correctly', async () => {
    const frequencies = [
      { frequency: 'daily', interval: 7, expected: new Date('2024-01-08') },
      { frequency: 'weekly', interval: 2, expected: new Date('2024-01-15') },
      { frequency: 'monthly', interval: 3, expected: new Date('2024-04-01') },
      { frequency: 'quarterly', interval: 2, expected: new Date('2024-07-01') },
      { frequency: 'yearly', interval: 2, expected: new Date('2026-01-01') }
    ];

    for (const freq of frequencies) {
      const testInput: CreateRecurringRuleInput = {
        account_id: accountId,
        category_id: categoryId,
        transaction_type: 'income',
        amount: 1000000,
        description: `Test ${freq.frequency} rule`,
        frequency: freq.frequency as any,
        interval_count: freq.interval,
        start_date: new Date('2024-01-01')
      };

      const result = await createRecurringRule(testInput, testUserId);
      expect(result.next_occurrence).toEqual(freq.expected);
    }
  });

  it('should save recurring rule to database', async () => {
    const testInput: CreateRecurringRuleInput = {
      account_id: accountId,
      category_id: categoryId,
      transaction_type: 'income',
      amount: 2500000,
      description: 'Bi-weekly Salary',
      frequency: 'weekly',
      interval_count: 2,
      start_date: new Date('2024-01-01')
    };

    const result = await createRecurringRule(testInput, testUserId);

    // Query the database directly
    const rules = await db.select()
      .from(recurringRulesTable)
      .where(eq(recurringRulesTable.id, result.id))
      .execute();

    expect(rules).toHaveLength(1);
    expect(rules[0].description).toEqual('Bi-weekly Salary');
    expect(parseFloat(rules[0].amount)).toEqual(2500000);
    expect(rules[0].frequency).toEqual('weekly');
    expect(rules[0].interval_count).toEqual(2);
    expect(rules[0].next_occurrence).toEqual(new Date('2024-01-15'));
  });

  it('should throw error for non-existent account', async () => {
    const testInput: CreateRecurringRuleInput = {
      account_id: '550e8400-e29b-41d4-a716-446655440999',
      transaction_type: 'income',
      amount: 1000000,
      description: 'Test Rule',
      frequency: 'monthly',
      interval_count: 1,
      start_date: new Date('2024-01-01')
    };

    await expect(createRecurringRule(testInput, testUserId))
      .rejects.toThrow(/account not found/i);
  });

  it('should throw error for non-existent transfer account', async () => {
    const testInput: CreateRecurringRuleInput = {
      account_id: accountId,
      to_account_id: '550e8400-e29b-41d4-a716-446655440999',
      transaction_type: 'transfer',
      amount: 1000000,
      description: 'Test Transfer',
      frequency: 'monthly',
      interval_count: 1,
      start_date: new Date('2024-01-01')
    };

    await expect(createRecurringRule(testInput, testUserId))
      .rejects.toThrow(/transfer destination account not found/i);
  });

  it('should throw error for non-existent category', async () => {
    const testInput: CreateRecurringRuleInput = {
      account_id: accountId,
      category_id: '550e8400-e29b-41d4-a716-446655440999',
      transaction_type: 'expense',
      amount: 1000000,
      description: 'Test Expense',
      frequency: 'monthly',
      interval_count: 1,
      start_date: new Date('2024-01-01')
    };

    await expect(createRecurringRule(testInput, testUserId))
      .rejects.toThrow(/category not found/i);
  });

  it('should throw error for account not belonging to user', async () => {
    const otherUserId = '550e8400-e29b-41d4-a716-446655440001';
    
    // Create account for different user
    await db.insert(profilesTable).values({
      ...testProfile,
      user_id: otherUserId,
      email: 'other@example.com'
    }).execute();
    
    const [otherAccount] = await db.insert(accountsTable).values({
      ...testAccount,
      user_id: otherUserId,
      name: 'Other User Account'
    }).returning().execute();

    const testInput: CreateRecurringRuleInput = {
      account_id: otherAccount.id,
      transaction_type: 'income',
      amount: 1000000,
      description: 'Test Rule',
      frequency: 'monthly',
      interval_count: 1,
      start_date: new Date('2024-01-01')
    };

    await expect(createRecurringRule(testInput, testUserId))
      .rejects.toThrow(/account not found or does not belong to user/i);
  });

  it('should handle year-end monthly calculation correctly', async () => {
    const testInput: CreateRecurringRuleInput = {
      account_id: accountId,
      category_id: categoryId,
      transaction_type: 'income',
      amount: 1000000,
      description: 'Year-end test',
      frequency: 'monthly',
      interval_count: 1,
      start_date: new Date('2023-12-31')
    };

    const result = await createRecurringRule(testInput, testUserId);

    // Next occurrence should be January 31, 2024
    expect(result.next_occurrence).toEqual(new Date('2024-01-31'));
  });

  it('should verify numeric type conversion', async () => {
    const testInput: CreateRecurringRuleInput = {
      account_id: accountId,
      category_id: categoryId,
      transaction_type: 'income',
      amount: 12345.67,
      description: 'Decimal amount test',
      frequency: 'monthly',
      interval_count: 1,
      start_date: new Date('2024-01-01')
    };

    const result = await createRecurringRule(testInput, testUserId);

    // Verify that the amount is properly converted back to number
    expect(typeof result.amount).toBe('number');
    expect(result.amount).toEqual(12345.67);
  });
});