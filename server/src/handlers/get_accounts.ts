import { db } from '../db';
import { accountsTable } from '../db/schema';
import { eq, isNull, desc, asc } from 'drizzle-orm';
import { type Account } from '../schema';

export const getAccounts = async (userId: string): Promise<Account[]> => {
  try {
    const results = await db.select()
      .from(accountsTable)
      .where(
        eq(accountsTable.user_id, userId)
      )
      .orderBy(
        desc(accountsTable.is_default),
        asc(accountsTable.created_at)
      )
      .execute();

    // Filter out soft-deleted accounts and convert numeric fields
    return results
      .filter(account => account.deleted_at === null)
      .map(account => ({
        ...account,
        balance: parseFloat(account.balance),
        initial_balance: parseFloat(account.initial_balance)
      }));
  } catch (error) {
    console.error('Failed to get accounts:', error);
    throw error;
  }
};