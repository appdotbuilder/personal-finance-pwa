import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { categoriesTable } from '../db/schema';
import { type CreateCategoryInput } from '../schema';
import { createCategory } from '../handlers/create_category';
import { eq } from 'drizzle-orm';

// Test user ID for isolation
const testUserId = '123e4567-e89b-12d3-a456-426614174000';

// Base test inputs
const expenseCategoryInput: CreateCategoryInput = {
  name: 'Food & Dining',
  category_type: 'expense',
  parent_id: null,
  color: '#FF5733',
  icon: 'restaurant'
};

const incomeCategoryInput: CreateCategoryInput = {
  name: 'Salary',
  category_type: 'income',
  parent_id: null,
  color: '#28A745',
  icon: 'work'
};

describe('createCategory', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create an expense category', async () => {
    const result = await createCategory(expenseCategoryInput, testUserId);

    // Basic field validation
    expect(result.name).toEqual('Food & Dining');
    expect(result.category_type).toEqual('expense');
    expect(result.user_id).toEqual(testUserId);
    expect(result.parent_id).toBeNull();
    expect(result.color).toEqual('#FF5733');
    expect(result.icon).toEqual('restaurant');
    expect(result.is_system).toBe(false);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.deleted_at).toBeNull();
  });

  it('should create an income category', async () => {
    const result = await createCategory(incomeCategoryInput, testUserId);

    expect(result.name).toEqual('Salary');
    expect(result.category_type).toEqual('income');
    expect(result.user_id).toEqual(testUserId);
    expect(result.parent_id).toBeNull();
    expect(result.color).toEqual('#28A745');
    expect(result.icon).toEqual('work');
    expect(result.is_system).toBe(false);
  });

  it('should save category to database', async () => {
    const result = await createCategory(expenseCategoryInput, testUserId);

    // Query database to verify save
    const categories = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, result.id))
      .execute();

    expect(categories).toHaveLength(1);
    expect(categories[0].name).toEqual('Food & Dining');
    expect(categories[0].category_type).toEqual('expense');
    expect(categories[0].user_id).toEqual(testUserId);
    expect(categories[0].is_system).toBe(false);
    expect(categories[0].created_at).toBeInstanceOf(Date);
  });

  it('should create subcategory with valid parent', async () => {
    // First create parent category
    const parentCategory = await createCategory(expenseCategoryInput, testUserId);

    // Create subcategory
    const subcategoryInput: CreateCategoryInput = {
      name: 'Fast Food',
      category_type: 'expense',
      parent_id: parentCategory.id,
      color: '#FF6B35',
      icon: 'fastfood'
    };

    const result = await createCategory(subcategoryInput, testUserId);

    expect(result.name).toEqual('Fast Food');
    expect(result.category_type).toEqual('expense');
    expect(result.parent_id).toEqual(parentCategory.id);
    expect(result.user_id).toEqual(testUserId);
  });

  it('should create category with minimal fields (no optional fields)', async () => {
    const minimalInput: CreateCategoryInput = {
      name: 'Basic Category',
      category_type: 'expense'
    };

    const result = await createCategory(minimalInput, testUserId);

    expect(result.name).toEqual('Basic Category');
    expect(result.category_type).toEqual('expense');
    expect(result.user_id).toEqual(testUserId);
    expect(result.parent_id).toBeNull();
    expect(result.color).toBeNull();
    expect(result.icon).toBeNull();
    expect(result.is_system).toBe(false);
  });

  it('should throw error when parent category does not exist', async () => {
    const subcategoryInput: CreateCategoryInput = {
      name: 'Fast Food',
      category_type: 'expense',
      parent_id: '00000000-0000-0000-0000-000000000000' // Non-existent ID
    };

    await expect(createCategory(subcategoryInput, testUserId))
      .rejects.toThrow(/parent category not found/i);
  });

  it('should throw error when parent category belongs to different user', async () => {
    // Create parent category with different user
    const otherUserId = '999e4567-e89b-12d3-a456-426614174999';
    const parentCategory = await createCategory(expenseCategoryInput, otherUserId);

    // Try to create subcategory with original user
    const subcategoryInput: CreateCategoryInput = {
      name: 'Fast Food',
      category_type: 'expense',
      parent_id: parentCategory.id
    };

    await expect(createCategory(subcategoryInput, testUserId))
      .rejects.toThrow(/parent category does not belong to user/i);
  });

  it('should throw error when parent and child have different category types', async () => {
    // Create expense parent category
    const parentCategory = await createCategory(expenseCategoryInput, testUserId);

    // Try to create income subcategory under expense parent
    const subcategoryInput: CreateCategoryInput = {
      name: 'Bonus Income',
      category_type: 'income',
      parent_id: parentCategory.id
    };

    await expect(createCategory(subcategoryInput, testUserId))
      .rejects.toThrow(/parent and child categories must have the same type/i);
  });

  it('should create multiple categories for same user', async () => {
    const category1 = await createCategory(expenseCategoryInput, testUserId);
    const category2 = await createCategory(incomeCategoryInput, testUserId);

    // Both should exist in database
    const categories = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.user_id, testUserId))
      .execute();

    expect(categories).toHaveLength(2);
    expect(categories.map(c => c.id)).toContain(category1.id);
    expect(categories.map(c => c.id)).toContain(category2.id);
  });

  it('should allow same category name for different users', async () => {
    const otherUserId = '999e4567-e89b-12d3-a456-426614174999';

    const category1 = await createCategory(expenseCategoryInput, testUserId);
    const category2 = await createCategory(expenseCategoryInput, otherUserId);

    expect(category1.name).toEqual(category2.name);
    expect(category1.user_id).toEqual(testUserId);
    expect(category2.user_id).toEqual(otherUserId);
    expect(category1.id).not.toEqual(category2.id);
  });

  it('should create deep nested subcategories', async () => {
    // Create parent -> child -> grandchild hierarchy
    const parent = await createCategory(expenseCategoryInput, testUserId);
    
    const childInput: CreateCategoryInput = {
      name: 'Restaurant Dining',
      category_type: 'expense',
      parent_id: parent.id
    };
    const child = await createCategory(childInput, testUserId);

    const grandchildInput: CreateCategoryInput = {
      name: 'Fine Dining',
      category_type: 'expense',
      parent_id: child.id
    };
    const grandchild = await createCategory(grandchildInput, testUserId);

    expect(grandchild.parent_id).toEqual(child.id);
    expect(child.parent_id).toEqual(parent.id);
    expect(parent.parent_id).toBeNull();

    // Verify all are saved correctly
    const categories = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.user_id, testUserId))
      .execute();

    expect(categories).toHaveLength(3);
  });
});