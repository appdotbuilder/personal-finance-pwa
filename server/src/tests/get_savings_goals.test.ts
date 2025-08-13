import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { profilesTable, accountsTable, savingsGoalsTable } from '../db/schema';
import { getSavingsGoals } from '../handlers/get_savings_goals';
import { eq } from 'drizzle-orm';

const testUserId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const testAccountId = 'f47ac10b-58cc-4372-a567-0e02b2c3d480';
const testGoalId = 'f47ac10b-58cc-4372-a567-0e02b2c3d481';

describe('getSavingsGoals', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when user has no savings goals', async () => {
    // Create user profile without any savings goals
    await db.insert(profilesTable).values({
      user_id: testUserId,
      display_name: 'Test User',
      email: 'test@example.com'
    }).execute();

    const result = await getSavingsGoals(testUserId);

    expect(result).toEqual([]);
  });

  it('should fetch user savings goals with numeric conversions', async () => {
    // Create user profile
    await db.insert(profilesTable).values({
      user_id: testUserId,
      display_name: 'Test User',
      email: 'test@example.com'
    }).execute();

    // Create account
    await db.insert(accountsTable).values({
      id: testAccountId,
      user_id: testUserId,
      name: 'Savings Account',
      account_type: 'savings',
      initial_balance: '5000.00'
    }).execute();

    // Create savings goal
    const targetDate = new Date('2024-12-31');
    await db.insert(savingsGoalsTable).values({
      id: testGoalId,
      user_id: testUserId,
      account_id: testAccountId,
      name: 'Emergency Fund',
      description: 'Build emergency savings',
      target_amount: '10000.50',
      current_amount: '2500.25',
      target_date: targetDate,
      status: 'active'
    }).execute();

    const result = await getSavingsGoals(testUserId);

    expect(result).toHaveLength(1);
    expect(result[0].id).toEqual(testGoalId);
    expect(result[0].name).toEqual('Emergency Fund');
    expect(result[0].description).toEqual('Build emergency savings');
    expect(result[0].target_amount).toEqual(10000.5);
    expect(result[0].current_amount).toEqual(2500.25);
    expect(typeof result[0].target_amount).toEqual('number');
    expect(typeof result[0].current_amount).toEqual('number');
    expect(result[0].target_date).toEqual(targetDate);
    expect(result[0].status).toEqual('active');
    expect(result[0].user_id).toEqual(testUserId);
    expect(result[0].account_id).toEqual(testAccountId);
  });

  it('should return multiple savings goals ordered correctly', async () => {
    // Create user profile
    await db.insert(profilesTable).values({
      user_id: testUserId,
      display_name: 'Test User',
      email: 'test@example.com'
    }).execute();

    // Create account
    await db.insert(accountsTable).values({
      id: testAccountId,
      user_id: testUserId,
      name: 'Savings Account',
      account_type: 'savings',
      initial_balance: '10000.00'
    }).execute();

    // Create multiple savings goals
    const goal1Id = 'f47ac10b-58cc-4372-a567-0e02b2c3d481';
    const goal2Id = 'f47ac10b-58cc-4372-a567-0e02b2c3d482';

    await db.insert(savingsGoalsTable).values([
      {
        id: goal1Id,
        user_id: testUserId,
        account_id: testAccountId,
        name: 'Emergency Fund',
        target_amount: '10000.00',
        current_amount: '2500.00',
        status: 'active'
      },
      {
        id: goal2Id,
        user_id: testUserId,
        account_id: testAccountId,
        name: 'Vacation Fund',
        target_amount: '5000.00',
        current_amount: '1500.00',
        status: 'active'
      }
    ]).execute();

    const result = await getSavingsGoals(testUserId);

    expect(result).toHaveLength(2);
    expect(result.map(g => g.name)).toEqual(expect.arrayContaining(['Emergency Fund', 'Vacation Fund']));
    
    // Verify numeric conversions for all goals
    result.forEach(goal => {
      expect(typeof goal.target_amount).toEqual('number');
      expect(typeof goal.current_amount).toEqual('number');
      expect(goal.target_amount).toBeGreaterThan(0);
      expect(goal.current_amount).toBeGreaterThanOrEqual(0);
    });
  });

  it('should exclude deleted savings goals', async () => {
    // Create user profile
    await db.insert(profilesTable).values({
      user_id: testUserId,
      display_name: 'Test User',
      email: 'test@example.com'
    }).execute();

    // Create account
    await db.insert(accountsTable).values({
      id: testAccountId,
      user_id: testUserId,
      name: 'Savings Account',
      account_type: 'savings',
      initial_balance: '5000.00'
    }).execute();

    // Create active and deleted savings goals
    const activeGoalId = 'f47ac10b-58cc-4372-a567-0e02b2c3d481';
    const deletedGoalId = 'f47ac10b-58cc-4372-a567-0e02b2c3d482';

    await db.insert(savingsGoalsTable).values([
      {
        id: activeGoalId,
        user_id: testUserId,
        account_id: testAccountId,
        name: 'Active Goal',
        target_amount: '5000.00',
        current_amount: '1000.00'
      },
      {
        id: deletedGoalId,
        user_id: testUserId,
        account_id: testAccountId,
        name: 'Deleted Goal',
        target_amount: '3000.00',
        current_amount: '500.00',
        deleted_at: new Date()
      }
    ]).execute();

    const result = await getSavingsGoals(testUserId);

    expect(result).toHaveLength(1);
    expect(result[0].id).toEqual(activeGoalId);
    expect(result[0].name).toEqual('Active Goal');
  });

  it('should exclude goals from deleted accounts', async () => {
    // Create user profile
    await db.insert(profilesTable).values({
      user_id: testUserId,
      display_name: 'Test User',
      email: 'test@example.com'
    }).execute();

    // Create active and deleted accounts
    const activeAccountId = 'f47ac10b-58cc-4372-a567-0e02b2c3d480';
    const deletedAccountId = 'f47ac10b-58cc-4372-a567-0e02b2c3d483';

    await db.insert(accountsTable).values([
      {
        id: activeAccountId,
        user_id: testUserId,
        name: 'Active Account',
        account_type: 'savings',
        initial_balance: '5000.00'
      },
      {
        id: deletedAccountId,
        user_id: testUserId,
        name: 'Deleted Account',
        account_type: 'savings',
        initial_balance: '3000.00',
        deleted_at: new Date()
      }
    ]).execute();

    // Create savings goals for both accounts
    await db.insert(savingsGoalsTable).values([
      {
        user_id: testUserId,
        account_id: activeAccountId,
        name: 'Goal for Active Account',
        target_amount: '5000.00',
        current_amount: '1000.00'
      },
      {
        user_id: testUserId,
        account_id: deletedAccountId,
        name: 'Goal for Deleted Account',
        target_amount: '3000.00',
        current_amount: '500.00'
      }
    ]).execute();

    const result = await getSavingsGoals(testUserId);

    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('Goal for Active Account');
    expect(result[0].account_id).toEqual(activeAccountId);
  });

  it('should handle different goal statuses correctly', async () => {
    // Create user profile
    await db.insert(profilesTable).values({
      user_id: testUserId,
      display_name: 'Test User',
      email: 'test@example.com'
    }).execute();

    // Create account
    await db.insert(accountsTable).values({
      id: testAccountId,
      user_id: testUserId,
      name: 'Savings Account',
      account_type: 'savings',
      initial_balance: '10000.00'
    }).execute();

    // Create goals with different statuses
    await db.insert(savingsGoalsTable).values([
      {
        user_id: testUserId,
        account_id: testAccountId,
        name: 'Active Goal',
        target_amount: '5000.00',
        current_amount: '2000.00',
        status: 'active'
      },
      {
        user_id: testUserId,
        account_id: testAccountId,
        name: 'Completed Goal',
        target_amount: '3000.00',
        current_amount: '3000.00',
        status: 'completed'
      },
      {
        user_id: testUserId,
        account_id: testAccountId,
        name: 'Paused Goal',
        target_amount: '2000.00',
        current_amount: '500.00',
        status: 'paused'
      }
    ]).execute();

    const result = await getSavingsGoals(testUserId);

    expect(result).toHaveLength(3);
    const statuses = result.map(g => g.status);
    expect(statuses).toEqual(expect.arrayContaining(['active', 'completed', 'paused']));
  });

  it('should only return goals for specified user', async () => {
    const otherUserId = 'f47ac10b-58cc-4372-a567-0e02b2c3d999';
    const otherAccountId = 'f47ac10b-58cc-4372-a567-0e02b2c3d998';

    // Create two users
    await db.insert(profilesTable).values([
      {
        user_id: testUserId,
        display_name: 'Test User 1',
        email: 'test1@example.com'
      },
      {
        user_id: otherUserId,
        display_name: 'Test User 2',
        email: 'test2@example.com'
      }
    ]).execute();

    // Create accounts for both users
    await db.insert(accountsTable).values([
      {
        id: testAccountId,
        user_id: testUserId,
        name: 'User 1 Account',
        account_type: 'savings',
        initial_balance: '5000.00'
      },
      {
        id: otherAccountId,
        user_id: otherUserId,
        name: 'User 2 Account',
        account_type: 'savings',
        initial_balance: '3000.00'
      }
    ]).execute();

    // Create goals for both users
    await db.insert(savingsGoalsTable).values([
      {
        user_id: testUserId,
        account_id: testAccountId,
        name: 'User 1 Goal',
        target_amount: '5000.00',
        current_amount: '2000.00'
      },
      {
        user_id: otherUserId,
        account_id: otherAccountId,
        name: 'User 2 Goal',
        target_amount: '3000.00',
        current_amount: '1000.00'
      }
    ]).execute();

    const result = await getSavingsGoals(testUserId);

    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('User 1 Goal');
    expect(result[0].user_id).toEqual(testUserId);
  });

  it('should save goals to database correctly', async () => {
    // Create user profile
    await db.insert(profilesTable).values({
      user_id: testUserId,
      display_name: 'Test User',
      email: 'test@example.com'
    }).execute();

    // Create account
    await db.insert(accountsTable).values({
      id: testAccountId,
      user_id: testUserId,
      name: 'Savings Account',
      account_type: 'savings',
      initial_balance: '5000.00'
    }).execute();

    // Create savings goal
    await db.insert(savingsGoalsTable).values({
      id: testGoalId,
      user_id: testUserId,
      account_id: testAccountId,
      name: 'Test Goal',
      target_amount: '8000.75',
      current_amount: '3250.25'
    }).execute();

    // Verify goal was saved correctly
    const savedGoals = await db.select()
      .from(savingsGoalsTable)
      .where(eq(savingsGoalsTable.id, testGoalId))
      .execute();

    expect(savedGoals).toHaveLength(1);
    expect(savedGoals[0].name).toEqual('Test Goal');
    expect(parseFloat(savedGoals[0].target_amount)).toEqual(8000.75);
    expect(parseFloat(savedGoals[0].current_amount)).toEqual(3250.25);
    expect(savedGoals[0].created_at).toBeInstanceOf(Date);

    // Also test the handler returns the same data
    const result = await getSavingsGoals(testUserId);
    expect(result).toHaveLength(1);
    expect(result[0].target_amount).toEqual(8000.75);
    expect(result[0].current_amount).toEqual(3250.25);
  });
});