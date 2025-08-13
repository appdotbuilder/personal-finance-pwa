import { db } from '../db';
import { budgetsTable, categoriesTable, transactionsTable } from '../db/schema';
import { type Budget } from '../schema';
import { eq, and, gte, lte, sum, isNull } from 'drizzle-orm';

export async function getBudgets(userId: string): Promise<Budget[]> {
  try {
    // Get all active budgets for the user with category information
    const budgets = await db
      .select({
        id: budgetsTable.id,
        user_id: budgetsTable.user_id,
        category_id: budgetsTable.category_id,
        name: budgetsTable.name,
        amount: budgetsTable.amount,
        spent: budgetsTable.spent,
        period_start: budgetsTable.period_start,
        period_end: budgetsTable.period_end,
        is_active: budgetsTable.is_active,
        created_at: budgetsTable.created_at,
        updated_at: budgetsTable.updated_at,
        deleted_at: budgetsTable.deleted_at
      })
      .from(budgetsTable)
      .innerJoin(categoriesTable, eq(budgetsTable.category_id, categoriesTable.id))
      .where(
        and(
          eq(budgetsTable.user_id, userId),
          eq(budgetsTable.is_active, true),
          isNull(budgetsTable.deleted_at),
          isNull(categoriesTable.deleted_at)
        )
      )
      .execute();

    // Calculate current spending for each budget from transactions
    const budgetsWithSpending = await Promise.all(
      budgets.map(async (budget) => {
        // Get total spending for this category within the budget period
        const spendingResult = await db
          .select({
            total_spent: sum(transactionsTable.amount)
          })
          .from(transactionsTable)
          .where(
            and(
              eq(transactionsTable.user_id, userId),
              eq(transactionsTable.category_id, budget.category_id),
              eq(transactionsTable.transaction_type, 'expense'),
              gte(transactionsTable.transaction_date, budget.period_start),
              lte(transactionsTable.transaction_date, budget.period_end),
              isNull(transactionsTable.deleted_at)
            )
          )
          .execute();

        const totalSpent = spendingResult[0]?.total_spent || '0';

        return {
          ...budget,
          amount: parseFloat(budget.amount),
          spent: parseFloat(totalSpent)
        };
      })
    );

    return budgetsWithSpending;
  } catch (error) {
    console.error('Get budgets failed:', error);
    throw error;
  }
}