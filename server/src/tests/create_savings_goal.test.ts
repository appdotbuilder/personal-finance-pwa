import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { savingsGoalsTable, accountsTable, profilesTable } from '../db/schema';
import { type CreateSavingsGoalInput } from '../schema';
import { createSavingsGoal } from '../handlers/create_savings_goal';
import { eq } from 'drizzle-orm';

// Test user data
const testUserId = '550e8400-e29b-41d4-a716-446655440000';
const testUserData = {
  user_id: testUserId,
  display_name: 'Test User',
  email: 'test@example.com'
};

// Test account data
const testAccountData = {
  user_id: testUserId,
  name: 'Test Savings Account',
  account_type: 'savings' as const,
  initial_balance: '5000.00'
};

// Test input for savings goal
const testInput: CreateSavingsGoalInput = {
  account_id: '', // Will be set after account creation
  name: 'Emergency Fund',
  description: 'Save for unexpected expenses',
  target_amount: 10000,
  target_date: new Date('2024-12-31')
};

describe('createSavingsGoal', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a savings goal', async () => {
    // Create prerequisite user profile
    await db.insert(profilesTable).values(testUserData);

    // Create prerequisite account
    const accountResult = await db.insert(accountsTable)
      .values(testAccountData)
      .returning()
      .execute();
    
    const account = accountResult[0];
    testInput.account_id = account.id;

    const result = await createSavingsGoal(testInput, testUserId);

    // Basic field validation
    expect(result.name).toEqual('Emergency Fund');
    expect(result.description).toEqual('Save for unexpected expenses');
    expect(result.target_amount).toEqual(10000);
    expect(result.current_amount).toEqual(0);
    expect(result.target_date).toEqual(testInput.target_date || null);
    expect(result.status).toEqual('active');
    expect(result.user_id).toEqual(testUserId);
    expect(result.account_id).toEqual(account.id);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.deleted_at).toBeNull();

    // Verify numeric types
    expect(typeof result.target_amount).toBe('number');
    expect(typeof result.current_amount).toBe('number');
  });

  it('should save savings goal to database', async () => {
    // Create prerequisite user profile
    await db.insert(profilesTable).values(testUserData);

    // Create prerequisite account
    const accountResult = await db.insert(accountsTable)
      .values(testAccountData)
      .returning()
      .execute();
    
    const account = accountResult[0];
    testInput.account_id = account.id;

    const result = await createSavingsGoal(testInput, testUserId);

    // Query using proper drizzle syntax
    const savingsGoals = await db.select()
      .from(savingsGoalsTable)
      .where(eq(savingsGoalsTable.id, result.id))
      .execute();

    expect(savingsGoals).toHaveLength(1);
    expect(savingsGoals[0].name).toEqual('Emergency Fund');
    expect(savingsGoals[0].description).toEqual('Save for unexpected expenses');
    expect(parseFloat(savingsGoals[0].target_amount)).toEqual(10000);
    expect(parseFloat(savingsGoals[0].current_amount)).toEqual(0);
    expect(savingsGoals[0].status).toEqual('active');
    expect(savingsGoals[0].user_id).toEqual(testUserId);
    expect(savingsGoals[0].account_id).toEqual(account.id);
    expect(savingsGoals[0].created_at).toBeInstanceOf(Date);
    expect(savingsGoals[0].updated_at).toBeInstanceOf(Date);
  });

  it('should create savings goal without optional fields', async () => {
    // Create prerequisite user profile
    await db.insert(profilesTable).values(testUserData);

    // Create prerequisite account
    const accountResult = await db.insert(accountsTable)
      .values(testAccountData)
      .returning()
      .execute();
    
    const account = accountResult[0];

    const minimalInput: CreateSavingsGoalInput = {
      account_id: account.id,
      name: 'Vacation Fund',
      target_amount: 5000
    };

    const result = await createSavingsGoal(minimalInput, testUserId);

    expect(result.name).toEqual('Vacation Fund');
    expect(result.description).toBeNull();
    expect(result.target_amount).toEqual(5000);
    expect(result.current_amount).toEqual(0);
    expect(result.target_date).toBeNull();
    expect(result.status).toEqual('active');
    expect(result.user_id).toEqual(testUserId);
    expect(result.account_id).toEqual(account.id);
  });

  it('should handle decimal target amounts correctly', async () => {
    // Create prerequisite user profile
    await db.insert(profilesTable).values(testUserData);

    // Create prerequisite account
    const accountResult = await db.insert(accountsTable)
      .values(testAccountData)
      .returning()
      .execute();
    
    const account = accountResult[0];

    const decimalInput: CreateSavingsGoalInput = {
      account_id: account.id,
      name: 'Precise Goal',
      target_amount: 1234.56
    };

    const result = await createSavingsGoal(decimalInput, testUserId);

    expect(result.target_amount).toEqual(1234.56);
    expect(typeof result.target_amount).toBe('number');

    // Verify in database
    const savingsGoals = await db.select()
      .from(savingsGoalsTable)
      .where(eq(savingsGoalsTable.id, result.id))
      .execute();

    expect(parseFloat(savingsGoals[0].target_amount)).toEqual(1234.56);
  });

  it('should throw error when account does not exist', async () => {
    // Create prerequisite user profile
    await db.insert(profilesTable).values(testUserData);

    const invalidInput: CreateSavingsGoalInput = {
      account_id: '00000000-0000-0000-0000-000000000000',
      name: 'Invalid Goal',
      target_amount: 1000
    };

    await expect(createSavingsGoal(invalidInput, testUserId)).rejects.toThrow(/account not found/i);
  });

  it('should throw error when account belongs to different user', async () => {
    const otherUserId = '550e8400-e29b-41d4-a716-446655440001';
    
    // Create prerequisite user profiles
    await db.insert(profilesTable).values(testUserData);
    await db.insert(profilesTable).values({
      user_id: otherUserId,
      display_name: 'Other User',
      email: 'other@example.com'
    });

    // Create account for other user
    const accountResult = await db.insert(accountsTable)
      .values({
        ...testAccountData,
        user_id: otherUserId
      })
      .returning()
      .execute();
    
    const account = accountResult[0];

    const unauthorizedInput: CreateSavingsGoalInput = {
      account_id: account.id,
      name: 'Unauthorized Goal',
      target_amount: 1000
    };

    await expect(createSavingsGoal(unauthorizedInput, testUserId)).rejects.toThrow(/account does not belong to user/i);
  });

  it('should create multiple savings goals for same account', async () => {
    // Create prerequisite user profile
    await db.insert(profilesTable).values(testUserData);

    // Create prerequisite account
    const accountResult = await db.insert(accountsTable)
      .values(testAccountData)
      .returning()
      .execute();
    
    const account = accountResult[0];

    const goal1: CreateSavingsGoalInput = {
      account_id: account.id,
      name: 'Goal 1',
      target_amount: 1000
    };

    const goal2: CreateSavingsGoalInput = {
      account_id: account.id,
      name: 'Goal 2',
      target_amount: 2000
    };

    const result1 = await createSavingsGoal(goal1, testUserId);
    const result2 = await createSavingsGoal(goal2, testUserId);

    expect(result1.id).not.toEqual(result2.id);
    expect(result1.name).toEqual('Goal 1');
    expect(result2.name).toEqual('Goal 2');
    expect(result1.target_amount).toEqual(1000);
    expect(result2.target_amount).toEqual(2000);

    // Verify both exist in database
    const allGoals = await db.select()
      .from(savingsGoalsTable)
      .where(eq(savingsGoalsTable.account_id, account.id))
      .execute();

    expect(allGoals).toHaveLength(2);
  });
});