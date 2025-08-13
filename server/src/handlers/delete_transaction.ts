import { db } from '../db';
import { transactionsTable, accountsTable } from '../db/schema';
import { eq, and, isNull } from 'drizzle-orm';

export const deleteTransaction = async (transactionId: string, userId: string): Promise<{ success: boolean }> => {
  try {
    // Find the transaction to validate ownership and get details for balance reversal
    const transactions = await db.select()
      .from(transactionsTable)
      .where(and(
        eq(transactionsTable.id, transactionId),
        eq(transactionsTable.user_id, userId),
        isNull(transactionsTable.deleted_at)
      ))
      .execute();

    if (transactions.length === 0) {
      throw new Error('Transaction not found or already deleted');
    }

    const transaction = transactions[0];
    const amount = parseFloat(transaction.amount);

    // Start transaction for atomic operations
    await db.transaction(async (tx) => {
      // Soft delete the transaction
      await tx.update(transactionsTable)
        .set({
          deleted_at: new Date(),
          updated_at: new Date()
        })
        .where(eq(transactionsTable.id, transactionId))
        .execute();

      // Reverse account balance changes based on transaction type
      if (transaction.transaction_type === 'income') {
        // Income was added to account balance, so subtract it back
        const accounts = await tx.select()
          .from(accountsTable)
          .where(eq(accountsTable.id, transaction.account_id))
          .execute();
        
        const currentBalance = parseFloat(accounts[0].balance);
        const newBalance = (currentBalance - amount).toString();
        
        await tx.update(accountsTable)
          .set({
            balance: newBalance,
            updated_at: new Date()
          })
          .where(eq(accountsTable.id, transaction.account_id))
          .execute();

      } else if (transaction.transaction_type === 'expense') {
        // Expense was subtracted from account balance, so add it back
        const accounts = await tx.select()
          .from(accountsTable)
          .where(eq(accountsTable.id, transaction.account_id))
          .execute();
        
        const currentBalance = parseFloat(accounts[0].balance);
        const newBalance = (currentBalance + amount).toString();
        
        await tx.update(accountsTable)
          .set({
            balance: newBalance,
            updated_at: new Date()
          })
          .where(eq(accountsTable.id, transaction.account_id))
          .execute();

      } else if (transaction.transaction_type === 'transfer' && transaction.to_account_id) {
        // Transfer: reverse both account changes
        // Add amount back to source account
        const sourceAccounts = await tx.select()
          .from(accountsTable)
          .where(eq(accountsTable.id, transaction.account_id))
          .execute();
        
        const sourceBalance = parseFloat(sourceAccounts[0].balance);
        const newSourceBalance = (sourceBalance + amount).toString();
        
        await tx.update(accountsTable)
          .set({
            balance: newSourceBalance,
            updated_at: new Date()
          })
          .where(eq(accountsTable.id, transaction.account_id))
          .execute();

        // Subtract amount from destination account
        const destAccounts = await tx.select()
          .from(accountsTable)
          .where(eq(accountsTable.id, transaction.to_account_id))
          .execute();
        
        const destBalance = parseFloat(destAccounts[0].balance);
        const newDestBalance = (destBalance - amount).toString();
        
        await tx.update(accountsTable)
          .set({
            balance: newDestBalance,
            updated_at: new Date()
          })
          .where(eq(accountsTable.id, transaction.to_account_id))
          .execute();
      }
    });

    return { success: true };
  } catch (error) {
    console.error('Transaction deletion failed:', error);
    throw error;
  }
};