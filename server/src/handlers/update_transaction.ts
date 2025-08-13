import { db } from '../db';
import { transactionsTable, accountsTable } from '../db/schema';
import { type UpdateTransactionInput, type Transaction } from '../schema';
import { eq, and, sql } from 'drizzle-orm';

export const updateTransaction = async (input: UpdateTransactionInput, userId: string): Promise<Transaction> => {
  try {
    // First, get the existing transaction with ownership validation
    const existingTransactions = await db.select()
      .from(transactionsTable)
      .where(and(
        eq(transactionsTable.id, input.id),
        eq(transactionsTable.user_id, userId)
      ))
      .execute();

    if (existingTransactions.length === 0) {
      throw new Error('Transaction not found or access denied');
    }

    const existingTransaction = existingTransactions[0];

    // Validate referenced accounts exist and belong to user if account_id is being changed
    if (input.account_id && input.account_id !== existingTransaction.account_id) {
      const accountExists = await db.select()
        .from(accountsTable)
        .where(and(
          eq(accountsTable.id, input.account_id),
          eq(accountsTable.user_id, userId)
        ))
        .execute();

      if (accountExists.length === 0) {
        throw new Error('Account not found or access denied');
      }
    }

    // Validate to_account_id if provided and not null
    if (input.to_account_id !== undefined && input.to_account_id !== null) {
      const toAccountExists = await db.select()
        .from(accountsTable)
        .where(and(
          eq(accountsTable.id, input.to_account_id),
          eq(accountsTable.user_id, userId)
        ))
        .execute();

      if (toAccountExists.length === 0) {
        throw new Error('To account not found or access denied');
      }
    }

    // Prepare update data with only provided fields
    const updateData: any = {};
    
    if (input.account_id !== undefined) updateData.account_id = input.account_id;
    if (input.to_account_id !== undefined) updateData.to_account_id = input.to_account_id;
    if (input.category_id !== undefined) updateData.category_id = input.category_id;
    if (input.transaction_type !== undefined) updateData.transaction_type = input.transaction_type;
    if (input.amount !== undefined) updateData.amount = input.amount.toString();
    if (input.description !== undefined) updateData.description = input.description;
    if (input.notes !== undefined) updateData.notes = input.notes;
    if (input.receipt_url !== undefined) updateData.receipt_url = input.receipt_url;
    if (input.transaction_date !== undefined) updateData.transaction_date = input.transaction_date;
    if (input.tags !== undefined) updateData.tags = input.tags;

    updateData.updated_at = new Date();

    // Execute transaction update within a database transaction for balance consistency
    const result = await db.transaction(async (tx) => {
      // Revert old balance impact
      const oldAmount = parseFloat(existingTransaction.amount);
      
      if (existingTransaction.transaction_type === 'income') {
        await tx.update(accountsTable)
          .set({ balance: sql`balance - ${oldAmount.toString()}` })
          .where(eq(accountsTable.id, existingTransaction.account_id))
          .execute();
      } else if (existingTransaction.transaction_type === 'expense') {
        await tx.update(accountsTable)
          .set({ balance: sql`balance + ${oldAmount.toString()}` })
          .where(eq(accountsTable.id, existingTransaction.account_id))
          .execute();
      } else if (existingTransaction.transaction_type === 'transfer') {
        // Revert transfer: add back to source, subtract from destination
        await tx.update(accountsTable)
          .set({ balance: sql`balance + ${oldAmount.toString()}` })
          .where(eq(accountsTable.id, existingTransaction.account_id))
          .execute();
        
        if (existingTransaction.to_account_id) {
          await tx.update(accountsTable)
            .set({ balance: sql`balance - ${oldAmount.toString()}` })
            .where(eq(accountsTable.id, existingTransaction.to_account_id))
            .execute();
        }
      }

      // Update the transaction
      const updatedTransactions = await tx.update(transactionsTable)
        .set(updateData)
        .where(eq(transactionsTable.id, input.id))
        .returning()
        .execute();

      const updatedTransaction = updatedTransactions[0];

      // Apply new balance impact
      const newAmount = parseFloat(updatedTransaction.amount);
      const newAccountId = updatedTransaction.account_id;
      const newToAccountId = updatedTransaction.to_account_id;
      const newTransactionType = updatedTransaction.transaction_type;

      if (newTransactionType === 'income') {
        await tx.update(accountsTable)
          .set({ balance: sql`balance + ${newAmount.toString()}` })
          .where(eq(accountsTable.id, newAccountId))
          .execute();
      } else if (newTransactionType === 'expense') {
        await tx.update(accountsTable)
          .set({ balance: sql`balance - ${newAmount.toString()}` })
          .where(eq(accountsTable.id, newAccountId))
          .execute();
      } else if (newTransactionType === 'transfer') {
        // Transfer: subtract from source, add to destination
        await tx.update(accountsTable)
          .set({ balance: sql`balance - ${newAmount.toString()}` })
          .where(eq(accountsTable.id, newAccountId))
          .execute();
        
        if (newToAccountId) {
          await tx.update(accountsTable)
            .set({ balance: sql`balance + ${newAmount.toString()}` })
            .where(eq(accountsTable.id, newToAccountId))
            .execute();
        }
      }

      return updatedTransaction;
    });

    // Convert numeric fields back to numbers and ensure tags is properly typed
    return {
      ...result,
      amount: parseFloat(result.amount),
      tags: Array.isArray(result.tags) ? result.tags as string[] : []
    };
  } catch (error) {
    console.error('Transaction update failed:', error);
    throw error;
  }
};