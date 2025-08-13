import { db } from '../db';
import { savingsGoalsTable, accountsTable } from '../db/schema';
import { type SavingsGoal } from '../schema';
import { eq, and, isNull } from 'drizzle-orm';

export const getSavingsGoals = async (userId: string): Promise<SavingsGoal[]> => {
  try {
    // Query savings goals with account information
    const results = await db.select()
      .from(savingsGoalsTable)
      .innerJoin(accountsTable, eq(savingsGoalsTable.account_id, accountsTable.id))
      .where(
        and(
          eq(savingsGoalsTable.user_id, userId),
          isNull(savingsGoalsTable.deleted_at),
          isNull(accountsTable.deleted_at)
        )
      )
      .execute();

    // Transform results and convert numeric fields
    return results.map(result => ({
      ...result.savings_goals,
      target_amount: parseFloat(result.savings_goals.target_amount),
      current_amount: parseFloat(result.savings_goals.current_amount)
    }));
  } catch (error) {
    console.error('Failed to fetch savings goals:', error);
    throw error;
  }
};