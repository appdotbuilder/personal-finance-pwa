import { db } from '../db';
import { accountsTable, transactionsTable, recurringRulesTable, savingsGoalsTable } from '../db/schema';
import { eq, and, isNull } from 'drizzle-orm';

export async function deleteAccount(accountId: string, userId: string): Promise<{ success: boolean }> {
  try {
    // First verify the account exists and belongs to the user
    const accounts = await db.select()
      .from(accountsTable)
      .where(
        and(
          eq(accountsTable.id, accountId),
          eq(accountsTable.user_id, userId),
          isNull(accountsTable.deleted_at)
        )
      )
      .execute();

    if (accounts.length === 0) {
      throw new Error('Account not found or access denied');
    }

    const account = accounts[0];

    // Check if account has any transactions (prevents deletion)
    const transactions = await db.select()
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.account_id, accountId),
          isNull(transactionsTable.deleted_at)
        )
      )
      .limit(1)
      .execute();

    if (transactions.length > 0) {
      throw new Error('Cannot delete account with existing transactions');
    }

    // Check if account is target of any transfer transactions
    const transferTransactions = await db.select()
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.to_account_id, accountId),
          isNull(transactionsTable.deleted_at)
        )
      )
      .limit(1)
      .execute();

    if (transferTransactions.length > 0) {
      throw new Error('Cannot delete account with existing transfer transactions');
    }

    // Check if account has any active recurring rules
    const recurringRules = await db.select()
      .from(recurringRulesTable)
      .where(
        and(
          eq(recurringRulesTable.account_id, accountId),
          eq(recurringRulesTable.is_active, true),
          isNull(recurringRulesTable.deleted_at)
        )
      )
      .limit(1)
      .execute();

    if (recurringRules.length > 0) {
      throw new Error('Cannot delete account with active recurring rules');
    }

    // Check if account is target of any active recurring rules
    const transferRecurringRules = await db.select()
      .from(recurringRulesTable)
      .where(
        and(
          eq(recurringRulesTable.to_account_id, accountId),
          eq(recurringRulesTable.is_active, true),
          isNull(recurringRulesTable.deleted_at)
        )
      )
      .limit(1)
      .execute();

    if (transferRecurringRules.length > 0) {
      throw new Error('Cannot delete account with active transfer recurring rules');
    }

    // Check if account has any active savings goals
    const savingsGoals = await db.select()
      .from(savingsGoalsTable)
      .where(
        and(
          eq(savingsGoalsTable.account_id, accountId),
          eq(savingsGoalsTable.status, 'active'),
          isNull(savingsGoalsTable.deleted_at)
        )
      )
      .limit(1)
      .execute();

    if (savingsGoals.length > 0) {
      throw new Error('Cannot delete account with active savings goals');
    }

    // Soft delete the account
    await db.update(accountsTable)
      .set({
        deleted_at: new Date(),
        updated_at: new Date()
      })
      .where(eq(accountsTable.id, accountId))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Account deletion failed:', error);
    throw error;
  }
}