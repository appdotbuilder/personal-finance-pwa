import { db } from '../db';
import { recurringRulesTable, accountsTable, categoriesTable } from '../db/schema';
import { type CreateRecurringRuleInput, type RecurringRule } from '../schema';
import { eq, and } from 'drizzle-orm';

// Helper function to calculate next occurrence based on frequency and interval
function calculateNextOccurrence(startDate: Date, frequency: string, intervalCount: number): Date {
  const nextDate = new Date(startDate);
  
  switch (frequency) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + intervalCount);
      break;
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + (7 * intervalCount));
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + intervalCount);
      break;
    case 'quarterly':
      nextDate.setMonth(nextDate.getMonth() + (3 * intervalCount));
      break;
    case 'yearly':
      nextDate.setFullYear(nextDate.getFullYear() + intervalCount);
      break;
    default:
      throw new Error(`Invalid frequency: ${frequency}`);
  }
  
  return nextDate;
}

export const createRecurringRule = async (input: CreateRecurringRuleInput, userId: string): Promise<RecurringRule> => {
  try {
    // Validate account exists and belongs to user
    const account = await db.select()
      .from(accountsTable)
      .where(and(
        eq(accountsTable.id, input.account_id),
        eq(accountsTable.user_id, userId)
      ))
      .execute();

    if (account.length === 0) {
      throw new Error('Account not found or does not belong to user');
    }

    // Validate to_account if provided (for transfers)
    if (input.to_account_id) {
      const toAccount = await db.select()
        .from(accountsTable)
        .where(and(
          eq(accountsTable.id, input.to_account_id),
          eq(accountsTable.user_id, userId)
        ))
        .execute();

      if (toAccount.length === 0) {
        throw new Error('Transfer destination account not found or does not belong to user');
      }
    }

    // Validate category if provided
    if (input.category_id) {
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
    }

    // Calculate next occurrence date
    const nextOccurrence = calculateNextOccurrence(input.start_date, input.frequency, input.interval_count);

    // Insert recurring rule record
    const result = await db.insert(recurringRulesTable)
      .values({
        user_id: userId,
        account_id: input.account_id,
        to_account_id: input.to_account_id || null,
        category_id: input.category_id || null,
        transaction_type: input.transaction_type,
        amount: input.amount.toString(), // Convert number to string for numeric column
        description: input.description,
        frequency: input.frequency,
        interval_count: input.interval_count,
        start_date: input.start_date,
        end_date: input.end_date || null,
        next_occurrence: nextOccurrence
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const recurringRule = result[0];
    return {
      ...recurringRule,
      amount: parseFloat(recurringRule.amount) // Convert string back to number
    };
  } catch (error) {
    console.error('Recurring rule creation failed:', error);
    throw error;
  }
};