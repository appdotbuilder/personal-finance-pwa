import { db } from '../db';
import { recurringRulesTable, accountsTable, categoriesTable } from '../db/schema';
import { type RecurringRule } from '../schema';
import { eq, isNull, and } from 'drizzle-orm';

export async function getRecurringRules(userId: string): Promise<RecurringRule[]> {
  try {
    const results = await db.select({
      id: recurringRulesTable.id,
      user_id: recurringRulesTable.user_id,
      account_id: recurringRulesTable.account_id,
      to_account_id: recurringRulesTable.to_account_id,
      category_id: recurringRulesTable.category_id,
      transaction_type: recurringRulesTable.transaction_type,
      amount: recurringRulesTable.amount,
      description: recurringRulesTable.description,
      frequency: recurringRulesTable.frequency,
      interval_count: recurringRulesTable.interval_count,
      start_date: recurringRulesTable.start_date,
      end_date: recurringRulesTable.end_date,
      next_occurrence: recurringRulesTable.next_occurrence,
      is_active: recurringRulesTable.is_active,
      created_at: recurringRulesTable.created_at,
      updated_at: recurringRulesTable.updated_at,
      deleted_at: recurringRulesTable.deleted_at
    })
    .from(recurringRulesTable)
    .where(
      and(
        eq(recurringRulesTable.user_id, userId),
        eq(recurringRulesTable.is_active, true),
        isNull(recurringRulesTable.deleted_at)
      )
    )
    .execute();

    // Convert numeric fields to numbers
    return results.map(rule => ({
      ...rule,
      amount: parseFloat(rule.amount)
    }));
  } catch (error) {
    console.error('Failed to fetch recurring rules:', error);
    throw error;
  }
}