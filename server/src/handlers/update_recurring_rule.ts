import { db } from '../db';
import { recurringRulesTable, accountsTable, categoriesTable } from '../db/schema';
import { type UpdateRecurringRuleInput, type RecurringRule } from '../schema';
import { eq, and, isNull } from 'drizzle-orm';

export const updateRecurringRule = async (input: UpdateRecurringRuleInput, userId: string): Promise<RecurringRule> => {
  try {
    // First verify the recurring rule exists and belongs to the user
    const existingRules = await db.select()
      .from(recurringRulesTable)
      .where(
        and(
          eq(recurringRulesTable.id, input.id),
          eq(recurringRulesTable.user_id, userId),
          isNull(recurringRulesTable.deleted_at)
        )
      )
      .execute();

    if (existingRules.length === 0) {
      throw new Error('Recurring rule not found');
    }

    const existingRule = existingRules[0];

    // Validate foreign key constraints if provided
    if (input.frequency && (input.frequency !== existingRule.frequency)) {
      // Need to verify account still exists
      const accounts = await db.select()
        .from(accountsTable)
        .where(
          and(
            eq(accountsTable.id, existingRule.account_id),
            eq(accountsTable.user_id, userId),
            isNull(accountsTable.deleted_at)
          )
        )
        .execute();

      if (accounts.length === 0) {
        throw new Error('Referenced account not found');
      }
    }

    // Prepare update values
    const updateValues: Record<string, any> = {
      updated_at: new Date()
    };

    // Add fields that are being updated
    if (input.amount !== undefined) {
      updateValues['amount'] = input.amount.toString();
    }
    if (input.description !== undefined) {
      updateValues['description'] = input.description;
    }
    if (input.frequency !== undefined) {
      updateValues['frequency'] = input.frequency;
    }
    if (input.interval_count !== undefined) {
      updateValues['interval_count'] = input.interval_count;
    }
    if (input.end_date !== undefined) {
      updateValues['end_date'] = input.end_date;
    }
    if (input.is_active !== undefined) {
      updateValues['is_active'] = input.is_active;
    }

    // Recalculate next occurrence if frequency or interval changed
    if (input.frequency !== undefined || input.interval_count !== undefined) {
      const frequency = input.frequency || existingRule.frequency;
      const intervalCount = input.interval_count || existingRule.interval_count;
      
      updateValues['next_occurrence'] = calculateNextOccurrence(
        existingRule.start_date,
        frequency,
        intervalCount
      );
    }

    // Perform the update
    const result = await db.update(recurringRulesTable)
      .set(updateValues)
      .where(eq(recurringRulesTable.id, input.id))
      .returning()
      .execute();

    // Convert numeric fields back to numbers
    const updatedRule = result[0];
    return {
      ...updatedRule,
      amount: parseFloat(updatedRule.amount)
    } as RecurringRule;
  } catch (error) {
    console.error('Recurring rule update failed:', error);
    throw error;
  }
};

function calculateNextOccurrence(startDate: Date, frequency: string, intervalCount: number): Date {
  const now = new Date();
  let nextOccurrence = new Date(startDate);

  // If start date is in the future, that's the next occurrence
  if (nextOccurrence > now) {
    return nextOccurrence;
  }

  // Calculate the next occurrence based on frequency
  while (nextOccurrence <= now) {
    switch (frequency) {
      case 'daily':
        nextOccurrence.setDate(nextOccurrence.getDate() + intervalCount);
        break;
      case 'weekly':
        nextOccurrence.setDate(nextOccurrence.getDate() + (intervalCount * 7));
        break;
      case 'monthly':
        nextOccurrence.setMonth(nextOccurrence.getMonth() + intervalCount);
        break;
      case 'quarterly':
        nextOccurrence.setMonth(nextOccurrence.getMonth() + (intervalCount * 3));
        break;
      case 'yearly':
        nextOccurrence.setFullYear(nextOccurrence.getFullYear() + intervalCount);
        break;
      default:
        throw new Error(`Unsupported frequency: ${frequency}`);
    }
  }

  return nextOccurrence;
}