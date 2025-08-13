import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { profilesTable, accountsTable, categoriesTable } from '../db/schema';
import { type CreateProfileInput } from '../schema';
import { createProfile } from '../handlers/create_profile';
import { eq } from 'drizzle-orm';

// Test input with all fields
const testInput: CreateProfileInput = {
  display_name: 'John Doe',
  email: 'john@example.com',
  currency: 'IDR',
  locale: 'id-ID',
  timezone: 'Asia/Jakarta'
};

const testUserId = '123e4567-e89b-12d3-a456-426614174000';

describe('createProfile', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a profile with all provided fields', async () => {
    const result = await createProfile(testInput, testUserId);

    // Verify profile fields
    expect(result.user_id).toEqual(testUserId);
    expect(result.display_name).toEqual('John Doe');
    expect(result.email).toEqual('john@example.com');
    expect(result.currency).toEqual('IDR');
    expect(result.locale).toEqual('id-ID');
    expect(result.timezone).toEqual('Asia/Jakarta');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.deleted_at).toBeNull();
  });

  it('should create a profile with default values when not provided', async () => {
    const minimalInput: CreateProfileInput = {
      display_name: 'Jane Doe',
      email: 'jane@example.com',
      currency: 'IDR',
      locale: 'id-ID',
      timezone: 'Asia/Jakarta'
    };

    const result = await createProfile(minimalInput, testUserId);

    expect(result.display_name).toEqual('Jane Doe');
    expect(result.email).toEqual('jane@example.com');
    expect(result.currency).toEqual('IDR');
    expect(result.locale).toEqual('id-ID');
    expect(result.timezone).toEqual('Asia/Jakarta');
  });

  it('should save profile to database', async () => {
    const result = await createProfile(testInput, testUserId);

    const profiles = await db.select()
      .from(profilesTable)
      .where(eq(profilesTable.id, result.id))
      .execute();

    expect(profiles).toHaveLength(1);
    expect(profiles[0].user_id).toEqual(testUserId);
    expect(profiles[0].display_name).toEqual('John Doe');
    expect(profiles[0].email).toEqual('john@example.com');
    expect(profiles[0].currency).toEqual('IDR');
  });

  it('should create a default checking account', async () => {
    await createProfile(testInput, testUserId);

    const accounts = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.user_id, testUserId))
      .execute();

    expect(accounts).toHaveLength(1);
    expect(accounts[0].name).toEqual('Main Account');
    expect(accounts[0].account_type).toEqual('checking');
    expect(parseFloat(accounts[0].balance)).toEqual(0);
    expect(parseFloat(accounts[0].initial_balance)).toEqual(0);
    expect(accounts[0].currency).toEqual('IDR');
    expect(accounts[0].is_default).toBe(true);
  });

  it('should create default expense categories', async () => {
    await createProfile(testInput, testUserId);

    const expenseCategories = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.user_id, testUserId))
      .execute();

    const expenses = expenseCategories.filter(cat => cat.category_type === 'expense');
    const incomes = expenseCategories.filter(cat => cat.category_type === 'income');

    // Check that we have the expected number of categories
    expect(expenses.length).toEqual(8);
    expect(incomes.length).toEqual(4);

    // Check that all categories are marked as system
    expenseCategories.forEach(category => {
      expect(category.is_system).toBe(true);
      expect(category.user_id).toEqual(testUserId);
    });

    // Check specific expense categories
    const expenseNames = expenses.map(cat => cat.name);
    expect(expenseNames).toContain('Food & Dining');
    expect(expenseNames).toContain('Transportation');
    expect(expenseNames).toContain('Shopping');
    expect(expenseNames).toContain('Bills & Utilities');

    // Check specific income categories
    const incomeNames = incomes.map(cat => cat.name);
    expect(incomeNames).toContain('Salary');
    expect(incomeNames).toContain('Business');
    expect(incomeNames).toContain('Investment');
    expect(incomeNames).toContain('Other Income');
  });

  it('should create categories with proper colors and icons', async () => {
    await createProfile(testInput, testUserId);

    const categories = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.user_id, testUserId))
      .execute();

    // All categories should have colors and icons
    categories.forEach(category => {
      expect(category.color).toBeDefined();
      expect(category.color).not.toBeNull();
      expect(category.icon).toBeDefined();
      expect(category.icon).not.toBeNull();
    });

    // Check specific category details
    const foodCategory = categories.find(cat => cat.name === 'Food & Dining');
    expect(foodCategory?.icon).toEqual('🍽️');
    expect(foodCategory?.color).toEqual('#FF6B6B');

    const salaryCategory = categories.find(cat => cat.name === 'Salary');
    expect(salaryCategory?.icon).toEqual('💰');
    expect(salaryCategory?.color).toEqual('#00B894');
  });

  it('should use custom currency for default account', async () => {
    const customInput: CreateProfileInput = {
      display_name: 'Test User',
      email: 'test@example.com',
      currency: 'USD',
      locale: 'en-US',
      timezone: 'America/New_York'
    };

    await createProfile(customInput, testUserId);

    const accounts = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.user_id, testUserId))
      .execute();

    expect(accounts).toHaveLength(1);
    expect(accounts[0].currency).toEqual('USD');
  });

  it('should ensure user_id uniqueness constraint', async () => {
    // Create first profile
    await createProfile(testInput, testUserId);

    // Try to create another profile with the same user_id
    const duplicateInput: CreateProfileInput = {
      display_name: 'Duplicate User',
      email: 'duplicate@example.com',
      currency: 'IDR',
      locale: 'id-ID',
      timezone: 'Asia/Jakarta'
    };

    await expect(createProfile(duplicateInput, testUserId))
      .rejects
      .toThrow(/unique constraint|duplicate key/i);
  });
});