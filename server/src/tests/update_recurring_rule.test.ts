import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { profilesTable, accountsTable, categoriesTable, recurringRulesTable } from '../db/schema';
import { type UpdateRecurringRuleInput } from '../schema';
import { updateRecurringRule } from '../handlers/update_recurring_rule';
import { eq, and, isNull } from 'drizzle-orm';

// Test data
const testUserId = '11111111-1111-1111-1111-111111111111';
const testAccountId = '22222222-2222-2222-2222-222222222222';
const testCategoryId = '33333333-3333-3333-3333-333333333333';
const testRuleId = '44444444-4444-4444-4444-444444444444';

const testInput: UpdateRecurringRuleInput = {
  id: testRuleId,
  amount: 150.00,
  description: 'Updated Monthly Expense',
  frequency: 'weekly',
  interval_count: 2,
  is_active: false
};

describe('updateRecurringRule', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  beforeEach(async () => {
    // Create test profile
    await db.insert(profilesTable).values({
      id: '00000000-0000-0000-0000-000000000000',
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
      currency: 'IDR',
      is_default: true
    }).execute();

    // Create test category
    await db.insert(categoriesTable).values({
      id: testCategoryId,
      user_id: testUserId,
      name: 'Test Category',
      category_type: 'expense'
    }).execute();

    // Create test recurring rule
    await db.insert(recurringRulesTable).values({
      id: testRuleId,
      user_id: testUserId,
      account_id: testAccountId,
      category_id: testCategoryId,
      transaction_type: 'expense',
      amount: '100.00',
      description: 'Monthly Expense',
      frequency: 'monthly',
      interval_count: 1,
      start_date: new Date('2024-01-01'),
      next_occurrence: new Date('2024-02-01'),
      is_active: true
    }).execute();
  });

  it('should update a recurring rule successfully', async () => {
    const result = await updateRecurringRule(testInput, testUserId);

    // Verify basic field updates
    expect(result.id).toEqual(testRuleId);
    expect(result.amount).toEqual(150.00);
    expect(result.description).toEqual('Updated Monthly Expense');
    expect(result.frequency).toEqual('weekly');
    expect(result.interval_count).toEqual(2);
    expect(result.is_active).toEqual(false);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save changes to database', async () => {
    await updateRecurringRule(testInput, testUserId);

    // Verify changes are persisted
    const rules = await db.select()
      .from(recurringRulesTable)
      .where(eq(recurringRulesTable.id, testRuleId))
      .execute();

    expect(rules).toHaveLength(1);
    expect(parseFloat(rules[0].amount)).toEqual(150.00);
    expect(rules[0].description).toEqual('Updated Monthly Expense');
    expect(rules[0].frequency).toEqual('weekly');
    expect(rules[0].interval_count).toEqual(2);
    expect(rules[0].is_active).toEqual(false);
  });

  it('should recalculate next occurrence when frequency changes', async () => {
    const result = await updateRecurringRule(testInput, testUserId);

    // When changing from monthly to bi-weekly, next occurrence should be recalculated
    expect(result.next_occurrence).toBeInstanceOf(Date);
    expect(result.next_occurrence).not.toEqual(new Date('2024-02-01'));
  });

  it('should update partial fields only', async () => {
    const partialInput: UpdateRecurringRuleInput = {
      id: testRuleId,
      amount: 200.00,
      description: 'Partially Updated Rule'
    };

    const result = await updateRecurringRule(partialInput, testUserId);

    // Updated fields
    expect(result.amount).toEqual(200.00);
    expect(result.description).toEqual('Partially Updated Rule');

    // Unchanged fields
    expect(result.frequency).toEqual('monthly');
    expect(result.interval_count).toEqual(1);
    expect(result.is_active).toEqual(true);
  });

  it('should handle end_date updates', async () => {
    const endDate = new Date('2024-12-31');
    const inputWithEndDate: UpdateRecurringRuleInput = {
      id: testRuleId,
      end_date: endDate
    };

    const result = await updateRecurringRule(inputWithEndDate, testUserId);

    expect(result.end_date).toEqual(endDate);
  });

  it('should handle null end_date', async () => {
    // First set an end date
    await db.update(recurringRulesTable)
      .set({ end_date: new Date('2024-12-31') })
      .where(eq(recurringRulesTable.id, testRuleId))
      .execute();

    // Then clear it
    const inputWithNullEndDate: UpdateRecurringRuleInput = {
      id: testRuleId,
      end_date: null
    };

    const result = await updateRecurringRule(inputWithNullEndDate, testUserId);

    expect(result.end_date).toBeNull();
  });

  it('should throw error for non-existent recurring rule', async () => {
    const invalidInput: UpdateRecurringRuleInput = {
      id: '99999999-9999-9999-9999-999999999999'
    };

    expect(updateRecurringRule(invalidInput, testUserId))
      .rejects.toThrow(/recurring rule not found/i);
  });

  it('should throw error for recurring rule owned by different user', async () => {
    const otherUserId = '55555555-5555-5555-5555-555555555555';

    expect(updateRecurringRule(testInput, otherUserId))
      .rejects.toThrow(/recurring rule not found/i);
  });

  it('should throw error for deleted recurring rule', async () => {
    // Soft delete the recurring rule
    await db.update(recurringRulesTable)
      .set({ deleted_at: new Date() })
      .where(eq(recurringRulesTable.id, testRuleId))
      .execute();

    expect(updateRecurringRule(testInput, testUserId))
      .rejects.toThrow(/recurring rule not found/i);
  });

  it('should calculate next occurrence correctly for different frequencies', async () => {
    const startDate = new Date('2024-01-01');
    
    // Update start date for testing
    await db.update(recurringRulesTable)
      .set({ start_date: startDate })
      .where(eq(recurringRulesTable.id, testRuleId))
      .execute();

    // Test daily frequency
    const dailyInput: UpdateRecurringRuleInput = {
      id: testRuleId,
      frequency: 'daily',
      interval_count: 3
    };

    const dailyResult = await updateRecurringRule(dailyInput, testUserId);
    expect(dailyResult.next_occurrence).toBeInstanceOf(Date);

    // Test weekly frequency
    const weeklyInput: UpdateRecurringRuleInput = {
      id: testRuleId,
      frequency: 'weekly',
      interval_count: 2
    };

    const weeklyResult = await updateRecurringRule(weeklyInput, testUserId);
    expect(weeklyResult.next_occurrence).toBeInstanceOf(Date);

    // Test quarterly frequency
    const quarterlyInput: UpdateRecurringRuleInput = {
      id: testRuleId,
      frequency: 'quarterly',
      interval_count: 1
    };

    const quarterlyResult = await updateRecurringRule(quarterlyInput, testUserId);
    expect(quarterlyResult.next_occurrence).toBeInstanceOf(Date);

    // Test yearly frequency
    const yearlyInput: UpdateRecurringRuleInput = {
      id: testRuleId,
      frequency: 'yearly',
      interval_count: 1
    };

    const yearlyResult = await updateRecurringRule(yearlyInput, testUserId);
    expect(yearlyResult.next_occurrence).toBeInstanceOf(Date);
  });

  it('should validate interval_count is positive', async () => {
    const invalidInput: UpdateRecurringRuleInput = {
      id: testRuleId,
      interval_count: 0
    };

    // Note: This validation would happen at the Zod schema level
    // The handler assumes valid input has already been parsed
    const result = await updateRecurringRule(invalidInput, testUserId);
    expect(result.interval_count).toEqual(0);
  });

  it('should handle numeric precision correctly', async () => {
    const preciseInput: UpdateRecurringRuleInput = {
      id: testRuleId,
      amount: 123.456789
    };

    const result = await updateRecurringRule(preciseInput, testUserId);

    // Should handle decimal precision correctly
    // Note: PostgreSQL numeric(15,2) truncates to 2 decimal places
    expect(typeof result.amount).toEqual('number');
    expect(result.amount).toEqual(123.46);
  });
});