import { db } from '../db';
import { savingsGoalsTable } from '../db/schema';
import { type UpdateSavingsGoalInput, type SavingsGoal } from '../schema';
import { eq, and, isNull } from 'drizzle-orm';

export const updateSavingsGoal = async (input: UpdateSavingsGoalInput, userId: string): Promise<SavingsGoal> => {
  try {
    // First, verify the savings goal exists and belongs to the user
    const existingGoals = await db.select()
      .from(savingsGoalsTable)
      .where(and(
        eq(savingsGoalsTable.id, input.id),
        eq(savingsGoalsTable.user_id, userId),
        isNull(savingsGoalsTable.deleted_at)
      ))
      .execute();

    if (existingGoals.length === 0) {
      throw new Error('Savings goal not found');
    }

    // Prepare update values, converting numeric fields to strings
    const updateValues: any = {
      updated_at: new Date()
    };

    if (input.name !== undefined) {
      updateValues.name = input.name;
    }
    if (input.description !== undefined) {
      updateValues.description = input.description;
    }
    if (input.target_amount !== undefined) {
      updateValues.target_amount = input.target_amount.toString();
    }
    if (input.target_date !== undefined) {
      updateValues.target_date = input.target_date;
    }
    if (input.status !== undefined) {
      updateValues.status = input.status;
    }

    // Update the savings goal
    const result = await db.update(savingsGoalsTable)
      .set(updateValues)
      .where(and(
        eq(savingsGoalsTable.id, input.id),
        eq(savingsGoalsTable.user_id, userId),
        isNull(savingsGoalsTable.deleted_at)
      ))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('Failed to update savings goal');
    }

    // Convert numeric fields back to numbers before returning
    const savingsGoal = result[0];
    return {
      ...savingsGoal,
      target_amount: parseFloat(savingsGoal.target_amount),
      current_amount: parseFloat(savingsGoal.current_amount)
    };
  } catch (error) {
    console.error('Savings goal update failed:', error);
    throw error;
  }
};