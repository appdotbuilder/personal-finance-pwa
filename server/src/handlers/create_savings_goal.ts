import { db } from '../db';
import { savingsGoalsTable, accountsTable } from '../db/schema';
import { type CreateSavingsGoalInput, type SavingsGoal } from '../schema';
import { eq } from 'drizzle-orm';

export const createSavingsGoal = async (input: CreateSavingsGoalInput, userId: string): Promise<SavingsGoal> => {
  try {
    // Validate that the account exists and belongs to the user
    const account = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.id, input.account_id))
      .execute();

    if (account.length === 0) {
      throw new Error('Account not found');
    }

    if (account[0].user_id !== userId) {
      throw new Error('Account does not belong to user');
    }

    // Insert savings goal record
    const result = await db.insert(savingsGoalsTable)
      .values({
        user_id: userId,
        account_id: input.account_id,
        name: input.name,
        description: input.description || null,
        target_amount: input.target_amount.toString(), // Convert number to string for numeric column
        current_amount: '0', // Initialize to 0
        target_date: input.target_date || null,
        status: 'active' // Default status
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const savingsGoal = result[0];
    return {
      ...savingsGoal,
      target_amount: parseFloat(savingsGoal.target_amount), // Convert string back to number
      current_amount: parseFloat(savingsGoal.current_amount) // Convert string back to number
    };
  } catch (error) {
    console.error('Savings goal creation failed:', error);
    throw error;
  }
};