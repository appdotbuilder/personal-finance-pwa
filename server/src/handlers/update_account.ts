import { db } from '../db';
import { accountsTable } from '../db/schema';
import { type UpdateAccountInput, type Account } from '../schema';
import { eq, and, ne } from 'drizzle-orm';

export const updateAccount = async (input: UpdateAccountInput, userId: string): Promise<Account> => {
  try {
    // First, verify the account exists and belongs to the user
    const existingAccount = await db.select()
      .from(accountsTable)
      .where(and(
        eq(accountsTable.id, input.id),
        eq(accountsTable.user_id, userId)
      ))
      .execute();

    if (existingAccount.length === 0) {
      throw new Error('Account not found or access denied');
    }

    // If setting this account as default, unset other default accounts for this user
    if (input.is_default === true) {
      await db.update(accountsTable)
        .set({ 
          is_default: false,
          updated_at: new Date()
        })
        .where(and(
          eq(accountsTable.user_id, userId),
          ne(accountsTable.id, input.id)
        ))
        .execute();
    }

    // Build update object with only provided fields
    const updateData: any = {
      updated_at: new Date()
    };

    if (input.name !== undefined) {
      updateData.name = input.name;
    }
    if (input.color !== undefined) {
      updateData.color = input.color;
    }
    if (input.icon !== undefined) {
      updateData.icon = input.icon;
    }
    if (input.is_default !== undefined) {
      updateData.is_default = input.is_default;
    }

    // Update the account
    const result = await db.update(accountsTable)
      .set(updateData)
      .where(and(
        eq(accountsTable.id, input.id),
        eq(accountsTable.user_id, userId)
      ))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('Failed to update account');
    }

    // Convert numeric fields back to numbers
    const updatedAccount = result[0];
    return {
      ...updatedAccount,
      balance: parseFloat(updatedAccount.balance),
      initial_balance: parseFloat(updatedAccount.initial_balance)
    };
  } catch (error) {
    console.error('Account update failed:', error);
    throw error;
  }
};