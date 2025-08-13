import { db } from '../db';
import { budgetsTable, categoriesTable } from '../db/schema';
import { type CreateBudgetInput, type Budget } from '../schema';
import { eq, and } from 'drizzle-orm';

export const createBudget = async (input: CreateBudgetInput, userId: string): Promise<Budget> => {
  try {
    // Validate that the category exists and belongs to the user
    const category = await db.select()
      .from(categoriesTable)
      .where(and(
        eq(categoriesTable.id, input.category_id),
        eq(categoriesTable.user_id, userId)
      ))
      .execute();

    if (category.length === 0) {
      throw new Error('Category not found or does not belong to user');
    }

    // Check for existing budget for same category and overlapping period
    const existingBudgets = await db.select()
      .from(budgetsTable)
      .where(and(
        eq(budgetsTable.user_id, userId),
        eq(budgetsTable.category_id, input.category_id),
        eq(budgetsTable.is_active, true)
      ))
      .execute();

    // Check for overlapping periods
    const hasOverlap = existingBudgets.some(budget => {
      const existingStart = budget.period_start;
      const existingEnd = budget.period_end;
      const newStart = input.period_start;
      const newEnd = input.period_end;

      // Check if periods overlap
      return (newStart <= existingEnd && newEnd >= existingStart);
    });

    if (hasOverlap) {
      throw new Error('A budget already exists for this category in the specified period');
    }

    // Insert budget record
    const result = await db.insert(budgetsTable)
      .values({
        user_id: userId,
        category_id: input.category_id,
        name: input.name,
        amount: input.amount.toString(), // Convert number to string for numeric column
        period_start: input.period_start,
        period_end: input.period_end
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const budget = result[0];
    return {
      ...budget,
      amount: parseFloat(budget.amount), // Convert string back to number
      spent: parseFloat(budget.spent) // Convert string back to number
    };
  } catch (error) {
    console.error('Budget creation failed:', error);
    throw error;
  }
};