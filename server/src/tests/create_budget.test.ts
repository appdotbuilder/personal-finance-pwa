import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { budgetsTable, categoriesTable, profilesTable } from '../db/schema';
import { type CreateBudgetInput } from '../schema';
import { createBudget } from '../handlers/create_budget';
import { eq, and } from 'drizzle-orm';

const userId = 'b1234567-89ab-cdef-0123-456789abcdef';

// Test profile data
const testProfile = {
  user_id: userId,
  display_name: 'Test User',
  email: 'test@example.com',
  currency: 'IDR',
  locale: 'id-ID',
  timezone: 'Asia/Jakarta'
};

// Test category data
const testCategory = {
  user_id: userId,
  name: 'Food & Dining',
  category_type: 'expense' as const,
  color: '#FF5733',
  icon: 'utensils'
};

// Test budget input
const testInput: CreateBudgetInput = {
  category_id: '', // Will be set after creating category
  name: 'Monthly Food Budget',
  amount: 500000,
  period_start: new Date('2024-01-01'),
  period_end: new Date('2024-01-31')
};

describe('createBudget', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a budget successfully', async () => {
    // Create prerequisite data
    await db.insert(profilesTable).values(testProfile).execute();
    const categoryResult = await db.insert(categoriesTable)
      .values(testCategory)
      .returning()
      .execute();
    
    const input = { ...testInput, category_id: categoryResult[0].id };
    const result = await createBudget(input, userId);

    // Verify budget fields
    expect(result.name).toEqual('Monthly Food Budget');
    expect(result.amount).toEqual(500000);
    expect(typeof result.amount).toEqual('number');
    expect(result.spent).toEqual(0);
    expect(typeof result.spent).toEqual('number');
    expect(result.category_id).toEqual(categoryResult[0].id);
    expect(result.user_id).toEqual(userId);
    expect(result.period_start).toEqual(new Date('2024-01-01'));
    expect(result.period_end).toEqual(new Date('2024-01-31'));
    expect(result.is_active).toBe(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.deleted_at).toBeNull();
  });

  it('should save budget to database', async () => {
    // Create prerequisite data
    await db.insert(profilesTable).values(testProfile).execute();
    const categoryResult = await db.insert(categoriesTable)
      .values(testCategory)
      .returning()
      .execute();
    
    const input = { ...testInput, category_id: categoryResult[0].id };
    const result = await createBudget(input, userId);

    // Query database to verify budget was saved
    const budgets = await db.select()
      .from(budgetsTable)
      .where(eq(budgetsTable.id, result.id))
      .execute();

    expect(budgets).toHaveLength(1);
    expect(budgets[0].name).toEqual('Monthly Food Budget');
    expect(parseFloat(budgets[0].amount)).toEqual(500000);
    expect(parseFloat(budgets[0].spent)).toEqual(0);
    expect(budgets[0].category_id).toEqual(categoryResult[0].id);
    expect(budgets[0].user_id).toEqual(userId);
    expect(budgets[0].is_active).toBe(true);
  });

  it('should throw error when category does not exist', async () => {
    // Create prerequisite profile but no category
    await db.insert(profilesTable).values(testProfile).execute();
    
    const input = { ...testInput, category_id: 'c1234567-89ab-cdef-0123-456789abcdef' };

    await expect(createBudget(input, userId)).rejects.toThrow(/category not found/i);
  });

  it('should throw error when category belongs to different user', async () => {
    // Create prerequisite data
    await db.insert(profilesTable).values(testProfile).execute();
    await db.insert(profilesTable).values({
      ...testProfile,
      user_id: 'a1234567-89ab-cdef-0123-456789abcdef',
      email: 'other@example.com'
    }).execute();
    
    const categoryResult = await db.insert(categoriesTable)
      .values({
        ...testCategory,
        user_id: 'a1234567-89ab-cdef-0123-456789abcdef' // Category belongs to different user
      })
      .returning()
      .execute();
    
    const input = { ...testInput, category_id: categoryResult[0].id };

    await expect(createBudget(input, userId)).rejects.toThrow(/category not found/i);
  });

  it('should throw error when overlapping budget exists', async () => {
    // Create prerequisite data
    await db.insert(profilesTable).values(testProfile).execute();
    const categoryResult = await db.insert(categoriesTable)
      .values(testCategory)
      .returning()
      .execute();
    
    const input = { ...testInput, category_id: categoryResult[0].id };

    // Create first budget
    await createBudget(input, userId);

    // Try to create overlapping budget (same period)
    const overlappingInput = {
      ...input,
      name: 'Another Food Budget',
      amount: 300000
    };

    await expect(createBudget(overlappingInput, userId)).rejects.toThrow(/budget already exists/i);
  });

  it('should throw error for partially overlapping periods', async () => {
    // Create prerequisite data
    await db.insert(profilesTable).values(testProfile).execute();
    const categoryResult = await db.insert(categoriesTable)
      .values(testCategory)
      .returning()
      .execute();
    
    const input = { ...testInput, category_id: categoryResult[0].id };

    // Create first budget (Jan 1-31)
    await createBudget(input, userId);

    // Try to create overlapping budget (Jan 15 - Feb 15)
    const overlappingInput = {
      ...input,
      name: 'Overlapping Food Budget',
      period_start: new Date('2024-01-15'),
      period_end: new Date('2024-02-15')
    };

    await expect(createBudget(overlappingInput, userId)).rejects.toThrow(/budget already exists/i);
  });

  it('should allow budget for different category in same period', async () => {
    // Create prerequisite data
    await db.insert(profilesTable).values(testProfile).execute();
    const foodCategoryResult = await db.insert(categoriesTable)
      .values(testCategory)
      .returning()
      .execute();
    const transportCategoryResult = await db.insert(categoriesTable)
      .values({
        ...testCategory,
        name: 'Transportation',
        color: '#3366FF',
        icon: 'car'
      })
      .returning()
      .execute();
    
    // Create budget for food category
    const foodInput = { ...testInput, category_id: foodCategoryResult[0].id };
    await createBudget(foodInput, userId);

    // Create budget for transport category in same period - should succeed
    const transportInput = {
      ...testInput,
      category_id: transportCategoryResult[0].id,
      name: 'Monthly Transport Budget',
      amount: 200000
    };

    const result = await createBudget(transportInput, userId);

    expect(result.name).toEqual('Monthly Transport Budget');
    expect(result.category_id).toEqual(transportCategoryResult[0].id);
    expect(result.amount).toEqual(200000);
  });

  it('should allow budget for same category in non-overlapping period', async () => {
    // Create prerequisite data
    await db.insert(profilesTable).values(testProfile).execute();
    const categoryResult = await db.insert(categoriesTable)
      .values(testCategory)
      .returning()
      .execute();
    
    // Create budget for January
    const januaryInput = { ...testInput, category_id: categoryResult[0].id };
    await createBudget(januaryInput, userId);

    // Create budget for February (non-overlapping) - should succeed
    const februaryInput = {
      ...testInput,
      category_id: categoryResult[0].id,
      name: 'February Food Budget',
      period_start: new Date('2024-02-01'),
      period_end: new Date('2024-02-29')
    };

    const result = await createBudget(februaryInput, userId);

    expect(result.name).toEqual('February Food Budget');
    expect(result.category_id).toEqual(categoryResult[0].id);
    expect(result.period_start).toEqual(new Date('2024-02-01'));
    expect(result.period_end).toEqual(new Date('2024-02-29'));
  });

  it('should ignore inactive budgets when checking for overlaps', async () => {
    // Create prerequisite data
    await db.insert(profilesTable).values(testProfile).execute();
    const categoryResult = await db.insert(categoriesTable)
      .values(testCategory)
      .returning()
      .execute();
    
    // Create and then deactivate a budget
    const input = { ...testInput, category_id: categoryResult[0].id };
    const firstBudget = await createBudget(input, userId);

    // Deactivate the first budget
    await db.update(budgetsTable)
      .set({ is_active: false })
      .where(eq(budgetsTable.id, firstBudget.id))
      .execute();

    // Create new budget for same category and period - should succeed
    const secondInput = {
      ...input,
      name: 'New Food Budget'
    };

    const result = await createBudget(secondInput, userId);

    expect(result.name).toEqual('New Food Budget');
    expect(result.category_id).toEqual(categoryResult[0].id);
  });
});