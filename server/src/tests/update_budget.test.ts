import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { budgetsTable, categoriesTable, profilesTable } from '../db/schema';
import { type UpdateBudgetInput, type CreateBudgetInput } from '../schema';
import { updateBudget } from '../handlers/update_budget';
import { eq, and } from 'drizzle-orm';

// Test data
const testUserId = '550e8400-e29b-41d4-a716-446655440000';
const testCategoryId = '550e8400-e29b-41d4-a716-446655440001';
const budgetId = '550e8400-e29b-41d4-a716-446655440002';
const otherUserId = '550e8400-e29b-41d4-a716-446655440003';

const testUpdateInput: UpdateBudgetInput = {
  id: budgetId,
  name: 'Updated Budget',
  amount: 1500.50,
  period_start: new Date('2024-02-01'),
  period_end: new Date('2024-02-29'),
  is_active: false
};

describe('updateBudget', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  beforeEach(async () => {
    // Create test profile
    await db.insert(profilesTable).values({
      id: testUserId,
      user_id: testUserId,
      display_name: 'Test User',
      email: 'test@example.com'
    }).execute();

    // Create test category
    await db.insert(categoriesTable).values({
      id: testCategoryId,
      user_id: testUserId,
      name: 'Test Category',
      category_type: 'expense'
    }).execute();

    // Create test budget
    await db.insert(budgetsTable).values({
      id: budgetId,
      user_id: testUserId,
      category_id: testCategoryId,
      name: 'Original Budget',
      amount: '1000.00',
      spent: '250.50',
      period_start: new Date('2024-01-01'),
      period_end: new Date('2024-01-31'),
      is_active: true
    }).execute();
  });

  it('should update budget successfully', async () => {
    const result = await updateBudget(testUpdateInput, testUserId);

    // Verify returned data
    expect(result.id).toEqual(budgetId);
    expect(result.user_id).toEqual(testUserId);
    expect(result.category_id).toEqual(testCategoryId);
    expect(result.name).toEqual('Updated Budget');
    expect(result.amount).toEqual(1500.5);
    expect(result.spent).toEqual(250.5); // Should remain unchanged
    expect(result.period_start).toEqual(new Date('2024-02-01'));
    expect(result.period_end).toEqual(new Date('2024-02-29'));
    expect(result.is_active).toEqual(false);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(typeof result.amount).toBe('number');
    expect(typeof result.spent).toBe('number');
  });

  it('should save updated budget to database', async () => {
    await updateBudget(testUpdateInput, testUserId);

    // Query the database to verify the update
    const budgets = await db.select()
      .from(budgetsTable)
      .where(eq(budgetsTable.id, budgetId))
      .execute();

    expect(budgets).toHaveLength(1);
    const budget = budgets[0];
    expect(budget.name).toEqual('Updated Budget');
    expect(parseFloat(budget.amount)).toEqual(1500.5);
    expect(parseFloat(budget.spent)).toEqual(250.5); // Should remain unchanged
    expect(budget.period_start).toEqual(new Date('2024-02-01'));
    expect(budget.period_end).toEqual(new Date('2024-02-29'));
    expect(budget.is_active).toEqual(false);
    expect(budget.updated_at).toBeInstanceOf(Date);
  });

  it('should update only specified fields', async () => {
    const partialUpdate: UpdateBudgetInput = {
      id: budgetId,
      name: 'Partially Updated Budget',
      amount: 2000.75
    };

    const result = await updateBudget(partialUpdate, testUserId);

    // Verify updated fields
    expect(result.name).toEqual('Partially Updated Budget');
    expect(result.amount).toEqual(2000.75);

    // Verify unchanged fields
    expect(result.spent).toEqual(250.5);
    expect(result.period_start).toEqual(new Date('2024-01-01'));
    expect(result.period_end).toEqual(new Date('2024-01-31'));
    expect(result.is_active).toEqual(true);
  });

  it('should throw error when budget not found', async () => {
    const nonExistentInput: UpdateBudgetInput = {
      id: '550e8400-e29b-41d4-a716-446655440999',
      name: 'Non-existent Budget'
    };

    await expect(updateBudget(nonExistentInput, testUserId)).rejects.toThrow(/not found/i);
  });

  it('should throw error when user does not own the budget', async () => {
    // Create another user's profile
    await db.insert(profilesTable).values({
      id: otherUserId,
      user_id: otherUserId,
      display_name: 'Other User',
      email: 'other@example.com'
    }).execute();

    await expect(updateBudget(testUpdateInput, otherUserId)).rejects.toThrow(/not found|access denied/i);
  });

  it('should handle numeric precision correctly', async () => {
    const precisionInput: UpdateBudgetInput = {
      id: budgetId,
      amount: 1234.56789 // High precision number
    };

    const result = await updateBudget(precisionInput, testUserId);

    // Verify the amount is handled correctly
    expect(result.amount).toBeCloseTo(1234.56789, 2);
    expect(typeof result.amount).toBe('number');

    // Verify in database
    const budgets = await db.select()
      .from(budgetsTable)
      .where(eq(budgetsTable.id, budgetId))
      .execute();

    expect(parseFloat(budgets[0].amount)).toBeCloseTo(1234.56789, 2);
  });

  it('should update updated_at timestamp', async () => {
    // Get original timestamp
    const originalBudgets = await db.select()
      .from(budgetsTable)
      .where(eq(budgetsTable.id, budgetId))
      .execute();
    const originalTimestamp = originalBudgets[0].updated_at;

    // Wait a bit to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    const result = await updateBudget({
      id: budgetId,
      name: 'Timestamp Test'
    }, testUserId);

    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at.getTime()).toBeGreaterThan(originalTimestamp.getTime());
  });
});