import { db } from '../db';
import { accountsTable } from '../db/schema';
import { type CreateAccountInput, type Account } from '../schema';

export const createAccount = async (input: CreateAccountInput, userId: string): Promise<Account> => {
  try {
    // Insert account record
    const result = await db.insert(accountsTable)
      .values({
        user_id: userId,
        name: input.name,
        account_type: input.account_type,
        balance: input.initial_balance?.toString() || '0', // Convert number to string for numeric column
        initial_balance: input.initial_balance?.toString() || '0', // Convert number to string for numeric column
        currency: input.currency || 'IDR',
        color: input.color || null,
        icon: input.icon || null,
        is_default: input.is_default || false
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const account = result[0];
    return {
      ...account,
      balance: parseFloat(account.balance), // Convert string back to number
      initial_balance: parseFloat(account.initial_balance) // Convert string back to number
    };
  } catch (error) {
    console.error('Account creation failed:', error);
    throw error;
  }
};