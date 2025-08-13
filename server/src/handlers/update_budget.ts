import { db } from '../db';
import { budgetsTable } from '../db/schema';
import { type UpdateBudgetInput, type Budget } from '../schema';
import { eq, and } from 'drizzle-orm';

export const updateBudget = async (input: UpdateBudgetInput, userId: string): Promise<Budget> => {
  try {
    // First, verify the budget exists and belongs to the user
    const existingBudget = await db.select()
      .from(budgetsTable)
      .where(and(
        eq(budgetsTable.id, input.id),
        eq(budgetsTable.user_id, userId)
      ))
      .execute();

    if (existingBudget.length === 0) {
      throw new Error('Budget not found or access denied');
    }

    // Build the update data from the input
    const updateData: Record<string, any> = {
      updated_at: new Date()
    };

    if (input.name !== undefined) {
      updateData['name'] = input.name;
    }

    if (input.amount !== undefined) {
      updateData['amount'] = input.amount.toString(); // Convert number to string for numeric column
    }

    if (input.period_start !== undefined) {
      updateData['period_start'] = input.period_start;
    }

    if (input.period_end !== undefined) {
      updateData['period_end'] = input.period_end;
    }

    if (input.is_active !== undefined) {
      updateData['is_active'] = input.is_active;
    }

    // Update the budget
    const result = await db.update(budgetsTable)
      .set(updateData)
      .where(and(
        eq(budgetsTable.id, input.id),
        eq(budgetsTable.user_id, userId)
      ))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('Failed to update budget');
    }

    // Convert numeric fields back to numbers before returning
    const budget = result[0];
    return {
      ...budget,
      amount: parseFloat(budget.amount),
      spent: parseFloat(budget.spent)
    };
  } catch (error) {
    console.error('Budget update failed:', error);
    throw error;
  }
};