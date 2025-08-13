import { db } from '../db';
import { transactionsTable, accountsTable, categoriesTable } from '../db/schema';
import { type CreateTransactionInput, type Transaction } from '../schema';
import { eq, and, isNull } from 'drizzle-orm';

export const createTransaction = async (input: CreateTransactionInput, userId: string): Promise<Transaction> => {
  try {
    // Validate source account ownership
    const sourceAccount = await db.select()
      .from(accountsTable)
      .where(and(
        eq(accountsTable.id, input.account_id),
        eq(accountsTable.user_id, userId),
        isNull(accountsTable.deleted_at)
      ))
      .execute();

    if (sourceAccount.length === 0) {
      throw new Error('Source account not found or not owned by user');
    }

    // For transfers, validate destination account ownership
    if (input.transaction_type === 'transfer' && !input.to_account_id) {
      throw new Error('Destination account is required for transfers');
    }

    if (input.to_account_id) {
      const destinationAccount = await db.select()
        .from(accountsTable)
        .where(and(
          eq(accountsTable.id, input.to_account_id),
          eq(accountsTable.user_id, userId),
          isNull(accountsTable.deleted_at)
        ))
        .execute();

      if (destinationAccount.length === 0) {
        throw new Error('Destination account not found or not owned by user');
      }

      if (input.to_account_id === input.account_id) {
        throw new Error('Source and destination accounts cannot be the same');
      }
    }

    // If category is provided, validate it exists and belongs to user
    if (input.category_id) {
      const category = await db.select()
        .from(categoriesTable)
        .where(and(
          eq(categoriesTable.id, input.category_id),
          eq(categoriesTable.user_id, userId),
          isNull(categoriesTable.deleted_at)
        ))
        .execute();

      if (category.length === 0) {
        throw new Error('Category not found or not owned by user');
      }

      // Validate category type matches transaction type (except for transfers)
      if (input.transaction_type !== 'transfer') {
        const expectedCategoryType = input.transaction_type;
        if (category[0].category_type !== expectedCategoryType) {
          throw new Error(`Category type must be ${expectedCategoryType} for ${expectedCategoryType} transactions`);
        }
      }
    }

    // Create transaction record
    const result = await db.insert(transactionsTable)
      .values({
        user_id: userId,
        account_id: input.account_id,
        to_account_id: input.to_account_id || null,
        category_id: input.category_id || null,
        transaction_type: input.transaction_type,
        amount: input.amount.toString(), // Convert number to string for numeric column
        description: input.description,
        notes: input.notes || null,
        receipt_url: input.receipt_url || null,
        transaction_date: input.transaction_date,
        tags: input.tags || []
      })
      .returning()
      .execute();

    const transaction = result[0];

    // Update account balances based on transaction type
    if (input.transaction_type === 'income') {
      // Increase source account balance
      await db.update(accountsTable)
        .set({
          balance: (parseFloat(sourceAccount[0].balance) + input.amount).toString(),
          updated_at: new Date()
        })
        .where(eq(accountsTable.id, input.account_id))
        .execute();
    } else if (input.transaction_type === 'expense') {
      // Decrease source account balance
      await db.update(accountsTable)
        .set({
          balance: (parseFloat(sourceAccount[0].balance) - input.amount).toString(),
          updated_at: new Date()
        })
        .where(eq(accountsTable.id, input.account_id))
        .execute();
    } else if (input.transaction_type === 'transfer' && input.to_account_id) {
      // For transfers: decrease source account, increase destination account
      const destinationAccount = await db.select()
        .from(accountsTable)
        .where(eq(accountsTable.id, input.to_account_id))
        .execute();

      await db.update(accountsTable)
        .set({
          balance: (parseFloat(sourceAccount[0].balance) - input.amount).toString(),
          updated_at: new Date()
        })
        .where(eq(accountsTable.id, input.account_id))
        .execute();

      await db.update(accountsTable)
        .set({
          balance: (parseFloat(destinationAccount[0].balance) + input.amount).toString(),
          updated_at: new Date()
        })
        .where(eq(accountsTable.id, input.to_account_id))
        .execute();
    }

    // Convert numeric fields back to numbers before returning
    return {
      ...transaction,
      amount: parseFloat(transaction.amount),
      tags: transaction.tags as string[] // Type cast the tags field
    };
  } catch (error) {
    console.error('Transaction creation failed:', error);
    throw error;
  }
};