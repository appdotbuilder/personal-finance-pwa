import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { profilesTable, accountsTable, savingsGoalsTable } from '../db/schema';
import { type UpdateSavingsGoalInput } from '../schema';
import { updateSavingsGoal } from '../handlers/update_savings_goal';
import { eq, and, isNull } from 'drizzle-orm';

// Test user and account data
const testUserId = '123e4567-e89b-12d3-a456-426614174000';
const testAccountId = 'a23e4567-e89b-12d3-a456-426614174000';
const testSavingsGoalId = 'b23e4567-e89b-12d3-a456-426614174000';
const otherUserId = '987f6543-e21c-34d5-b678-532717251000';

// Setup data for tests
const createTestData = async () => {
  // Create test profile
  await db.insert(profilesTable).values({
    id: 'c23e4567-e89b-12d3-a456-426614174000',
    user_id: testUserId,
    display_name: 'Test User',
    email: 'test@example.com'
  }).execute();

  // Create test account
  await db.insert(accountsTable).values({
    id: testAccountId,
    user_id: testUserId,
    name: 'Test Savings Account',
    account_type: 'savings',
    initial_balance: '1000.00'
  }).execute();

  // Create test savings goal
  await db.insert(savingsGoalsTable).values({
    id: testSavingsGoalId,
    user_id: testUserId,
    account_id: testAccountId,
    name: 'Vacation Fund',
    description: 'Save for vacation',
    target_amount: '5000.00',
    current_amount: '1000.00',
    target_date: new Date('2024-12-31'),
    status: 'active'
  }).execute();

  // Create another user's profile and savings goal for ownership tests
  await db.insert(profilesTable).values({
    id: 'd87f6543-e21c-34d5-b678-532717251000',
    user_id: otherUserId,
    display_name: 'Other User',
    email: 'other@example.com'
  }).execute();

  await db.insert(accountsTable).values({
    id: 'e87f6543-e21c-34d5-b678-532717251000',
    user_id: otherUserId,
    name: 'Other Account',
    account_type: 'savings'
  }).execute();

  await db.insert(savingsGoalsTable).values({
    id: 'f87f6543-e21c-34d5-b678-532717251000',
    user_id: otherUserId,
    account_id: 'e87f6543-e21c-34d5-b678-532717251000',
    name: 'Other Goal',
    target_amount: '3000.00'
  }).execute();
};

// Test input for basic update
const basicUpdateInput: UpdateSavingsGoalInput = {
  id: testSavingsGoalId,
  name: 'Updated Vacation Fund',
  description: 'Updated description for vacation',
  target_amount: 7500.50,
  target_date: new Date('2025-06-30'),
  status: 'active'
};

describe('updateSavingsGoal', () => {
  beforeEach(async () => {
    await createDB();
    await createTestData();
  });
  afterEach(resetDB);

  it('should update savings goal with all fields', async () => {
    const result = await updateSavingsGoal(basicUpdateInput, testUserId);

    // Verify all updated fields
    expect(result.id).toEqual(testSavingsGoalId);
    expect(result.user_id).toEqual(testUserId);
    expect(result.name).toEqual('Updated Vacation Fund');
    expect(result.description).toEqual('Updated description for vacation');
    expect(result.target_amount).toEqual(7500.50);
    expect(typeof result.target_amount).toEqual('number');
    expect(result.target_date).toEqual(new Date('2025-06-30'));
    expect(result.status).toEqual('active');
    expect(result.current_amount).toEqual(1000); // Should remain unchanged
    expect(typeof result.current_amount).toEqual('number');
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save updated savings goal to database', async () => {
    await updateSavingsGoal(basicUpdateInput, testUserId);

    // Verify in database
    const savingsGoals = await db.select()
      .from(savingsGoalsTable)
      .where(eq(savingsGoalsTable.id, testSavingsGoalId))
      .execute();

    expect(savingsGoals).toHaveLength(1);
    const goal = savingsGoals[0];
    expect(goal.name).toEqual('Updated Vacation Fund');
    expect(goal.description).toEqual('Updated description for vacation');
    expect(parseFloat(goal.target_amount)).toEqual(7500.50);
    expect(goal.target_date).toEqual(new Date('2025-06-30'));
    expect(goal.status).toEqual('active');
    expect(parseFloat(goal.current_amount)).toEqual(1000);
    expect(goal.updated_at).toBeInstanceOf(Date);
  });

  it('should update only specified fields', async () => {
    const partialInput: UpdateSavingsGoalInput = {
      id: testSavingsGoalId,
      name: 'New Goal Name',
      status: 'paused'
    };

    const result = await updateSavingsGoal(partialInput, testUserId);

    // Verify updated fields
    expect(result.name).toEqual('New Goal Name');
    expect(result.status).toEqual('paused');
    
    // Verify unchanged fields
    expect(result.description).toEqual('Save for vacation');
    expect(result.target_amount).toEqual(5000);
    expect(result.target_date).toEqual(new Date('2024-12-31'));
    expect(result.current_amount).toEqual(1000);
  });

  it('should handle status change to completed', async () => {
    const statusUpdateInput: UpdateSavingsGoalInput = {
      id: testSavingsGoalId,
      status: 'completed'
    };

    const result = await updateSavingsGoal(statusUpdateInput, testUserId);

    expect(result.status).toEqual('completed');
    expect(result.name).toEqual('Vacation Fund'); // Unchanged
  });

  it('should handle null description update', async () => {
    const nullDescriptionInput: UpdateSavingsGoalInput = {
      id: testSavingsGoalId,
      description: null
    };

    const result = await updateSavingsGoal(nullDescriptionInput, testUserId);

    expect(result.description).toBeNull();
    expect(result.name).toEqual('Vacation Fund'); // Unchanged
  });

  it('should handle null target_date update', async () => {
    const nullDateInput: UpdateSavingsGoalInput = {
      id: testSavingsGoalId,
      target_date: null
    };

    const result = await updateSavingsGoal(nullDateInput, testUserId);

    expect(result.target_date).toBeNull();
    expect(result.name).toEqual('Vacation Fund'); // Unchanged
  });

  it('should throw error when savings goal not found', async () => {
    const invalidInput: UpdateSavingsGoalInput = {
      id: '99999999-9999-9999-9999-999999999999'
    };

    await expect(updateSavingsGoal(invalidInput, testUserId))
      .rejects.toThrow(/savings goal not found/i);
  });

  it('should throw error when user does not own savings goal', async () => {
    const otherUserInput: UpdateSavingsGoalInput = {
      id: testSavingsGoalId,
      name: 'Trying to update other user goal'
    };

    await expect(updateSavingsGoal(otherUserInput, otherUserId))
      .rejects.toThrow(/savings goal not found/i);
  });

  it('should not update soft-deleted savings goal', async () => {
    // Soft delete the savings goal
    await db.update(savingsGoalsTable)
      .set({ deleted_at: new Date() })
      .where(eq(savingsGoalsTable.id, testSavingsGoalId))
      .execute();

    const updateInput: UpdateSavingsGoalInput = {
      id: testSavingsGoalId,
      name: 'Should not work'
    };

    await expect(updateSavingsGoal(updateInput, testUserId))
      .rejects.toThrow(/savings goal not found/i);
  });

  it('should handle large target amount correctly', async () => {
    const largeAmountInput: UpdateSavingsGoalInput = {
      id: testSavingsGoalId,
      target_amount: 999999.99
    };

    const result = await updateSavingsGoal(largeAmountInput, testUserId);

    expect(result.target_amount).toEqual(999999.99);
    expect(typeof result.target_amount).toEqual('number');

    // Verify in database
    const dbGoal = await db.select()
      .from(savingsGoalsTable)
      .where(eq(savingsGoalsTable.id, testSavingsGoalId))
      .execute();

    expect(parseFloat(dbGoal[0].target_amount)).toEqual(999999.99);
  });

  it('should update updated_at timestamp', async () => {
    // Get original timestamp
    const originalGoal = await db.select()
      .from(savingsGoalsTable)
      .where(eq(savingsGoalsTable.id, testSavingsGoalId))
      .execute();

    const originalUpdatedAt = originalGoal[0].updated_at;

    // Wait a bit to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    const result = await updateSavingsGoal({
      id: testSavingsGoalId,
      name: 'Timestamp Test'
    }, testUserId);

    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at > originalUpdatedAt).toBe(true);
  });
});