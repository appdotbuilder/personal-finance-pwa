import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { categoriesTable } from '../db/schema';
import { getCategories } from '../handlers/get_categories';
import { eq, and } from 'drizzle-orm';

const testUserId = '12345678-1234-1234-1234-123456789012';

describe('getCategories', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no categories exist', async () => {
    const result = await getCategories(testUserId);
    expect(result).toEqual([]);
  });

  it('should fetch user-specific categories', async () => {
    // Create a user-specific category
    await db.insert(categoriesTable)
      .values({
        user_id: testUserId,
        name: 'User Category',
        category_type: 'expense',
        parent_id: null,
        color: '#FF0000',
        icon: 'icon-expense',
        is_system: false
      })
      .execute();

    const result = await getCategories(testUserId);
    
    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('User Category');
    expect(result[0].category_type).toEqual('expense');
    expect(result[0].user_id).toEqual(testUserId);
    expect(result[0].color).toEqual('#FF0000');
    expect(result[0].icon).toEqual('icon-expense');
    expect(result[0].is_system).toEqual(false);
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeInstanceOf(Date);
  });

  it('should fetch system categories', async () => {
    // Create a system category
    await db.insert(categoriesTable)
      .values({
        user_id: '00000000-0000-0000-0000-000000000000', // Different user ID
        name: 'System Category',
        category_type: 'income',
        parent_id: null,
        color: '#00FF00',
        icon: 'icon-income',
        is_system: true
      })
      .execute();

    const result = await getCategories(testUserId);
    
    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('System Category');
    expect(result[0].category_type).toEqual('income');
    expect(result[0].is_system).toEqual(true);
    expect(result[0].color).toEqual('#00FF00');
    expect(result[0].icon).toEqual('icon-income');
  });

  it('should fetch both user and system categories', async () => {
    // Create a user-specific category
    await db.insert(categoriesTable)
      .values({
        user_id: testUserId,
        name: 'User Category',
        category_type: 'expense',
        parent_id: null,
        is_system: false
      })
      .execute();

    // Create a system category
    await db.insert(categoriesTable)
      .values({
        user_id: '00000000-0000-0000-0000-000000000000',
        name: 'System Category',
        category_type: 'income',
        parent_id: null,
        is_system: true
      })
      .execute();

    const result = await getCategories(testUserId);
    
    expect(result).toHaveLength(2);
    
    const userCategory = result.find(cat => cat.name === 'User Category');
    const systemCategory = result.find(cat => cat.name === 'System Category');
    
    expect(userCategory).toBeDefined();
    expect(userCategory!.is_system).toEqual(false);
    expect(userCategory!.user_id).toEqual(testUserId);
    
    expect(systemCategory).toBeDefined();
    expect(systemCategory!.is_system).toEqual(true);
  });

  it('should include parent-child relationships', async () => {
    // Create parent category
    const parentResult = await db.insert(categoriesTable)
      .values({
        user_id: testUserId,
        name: 'Parent Category',
        category_type: 'expense',
        parent_id: null,
        is_system: false
      })
      .returning()
      .execute();

    const parentId = parentResult[0].id;

    // Create child category
    await db.insert(categoriesTable)
      .values({
        user_id: testUserId,
        name: 'Child Category',
        category_type: 'expense',
        parent_id: parentId,
        is_system: false
      })
      .execute();

    const result = await getCategories(testUserId);
    
    expect(result).toHaveLength(2);
    
    const parentCategory = result.find(cat => cat.name === 'Parent Category');
    const childCategory = result.find(cat => cat.name === 'Child Category');
    
    expect(parentCategory).toBeDefined();
    expect(parentCategory!.parent_id).toBeNull();
    
    expect(childCategory).toBeDefined();
    expect(childCategory!.parent_id).toEqual(parentId);
  });

  it('should exclude deleted categories', async () => {
    // Create an active category
    await db.insert(categoriesTable)
      .values({
        user_id: testUserId,
        name: 'Active Category',
        category_type: 'expense',
        parent_id: null,
        is_system: false
      })
      .execute();

    // Create a deleted category
    await db.insert(categoriesTable)
      .values({
        user_id: testUserId,
        name: 'Deleted Category',
        category_type: 'expense',
        parent_id: null,
        is_system: false,
        deleted_at: new Date()
      })
      .execute();

    const result = await getCategories(testUserId);
    
    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('Active Category');
    expect(result[0].deleted_at).toBeNull();
  });

  it('should not return categories from other users', async () => {
    const otherUserId = '87654321-4321-4321-4321-210987654321';
    
    // Create category for another user
    await db.insert(categoriesTable)
      .values({
        user_id: otherUserId,
        name: 'Other User Category',
        category_type: 'expense',
        parent_id: null,
        is_system: false
      })
      .execute();

    // Create category for test user
    await db.insert(categoriesTable)
      .values({
        user_id: testUserId,
        name: 'My Category',
        category_type: 'expense',
        parent_id: null,
        is_system: false
      })
      .execute();

    const result = await getCategories(testUserId);
    
    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('My Category');
    expect(result[0].user_id).toEqual(testUserId);
  });

  it('should handle categories with all optional fields', async () => {
    // Create category with minimal fields
    await db.insert(categoriesTable)
      .values({
        user_id: testUserId,
        name: 'Minimal Category',
        category_type: 'income',
        parent_id: null,
        color: null,
        icon: null,
        is_system: false
      })
      .execute();

    const result = await getCategories(testUserId);
    
    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('Minimal Category');
    expect(result[0].color).toBeNull();
    expect(result[0].icon).toBeNull();
    expect(result[0].parent_id).toBeNull();
  });

  it('should verify categories are saved correctly in database', async () => {
    await db.insert(categoriesTable)
      .values({
        user_id: testUserId,
        name: 'Test Category',
        category_type: 'expense',
        parent_id: null,
        color: '#123456',
        icon: 'test-icon',
        is_system: false
      })
      .execute();

    // Verify in database
    const dbCategories = await db.select()
      .from(categoriesTable)
      .where(
        and(
          eq(categoriesTable.user_id, testUserId),
          eq(categoriesTable.name, 'Test Category')
        )
      )
      .execute();

    expect(dbCategories).toHaveLength(1);
    expect(dbCategories[0].name).toEqual('Test Category');
    expect(dbCategories[0].category_type).toEqual('expense');
    expect(dbCategories[0].color).toEqual('#123456');
    expect(dbCategories[0].icon).toEqual('test-icon');
  });
});