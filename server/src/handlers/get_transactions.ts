import { db } from '../db';
import { transactionsTable } from '../db/schema';
import { type GetTransactionsInput, type Transaction } from '../schema';
import { eq, and, gte, lte, desc, SQL, count } from 'drizzle-orm';

export async function getTransactions(input: GetTransactionsInput, userId: string): Promise<{ transactions: Transaction[]; total: number }> {
  try {
    // Build conditions array
    const conditions: SQL<unknown>[] = [];
    
    // Always filter by user_id
    conditions.push(eq(transactionsTable.user_id, userId));
    
    // Add optional filters
    if (input.account_id) {
      conditions.push(eq(transactionsTable.account_id, input.account_id));
    }
    
    if (input.category_id) {
      conditions.push(eq(transactionsTable.category_id, input.category_id));
    }
    
    if (input.transaction_type) {
      conditions.push(eq(transactionsTable.transaction_type, input.transaction_type));
    }
    
    if (input.start_date) {
      conditions.push(gte(transactionsTable.transaction_date, input.start_date));
    }
    
    if (input.end_date) {
      conditions.push(lte(transactionsTable.transaction_date, input.end_date));
    }

    // Build and execute main query
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const results = await db
      .select()
      .from(transactionsTable)
      .where(whereClause)
      .orderBy(desc(transactionsTable.transaction_date), desc(transactionsTable.created_at))
      .limit(input.limit)
      .offset(input.offset)
      .execute();

    // Convert numeric fields and handle tags properly
    const transactions: Transaction[] = results.map(transaction => ({
      ...transaction,
      amount: parseFloat(transaction.amount),
      tags: Array.isArray(transaction.tags) ? transaction.tags as string[] : []
    }));

    // Get total count for pagination
    const countResult = await db
      .select({ count: count() })
      .from(transactionsTable)
      .where(whereClause)
      .execute();

    const total = countResult[0]?.count || 0;

    return {
      transactions,
      total
    };
  } catch (error) {
    console.error('Transaction retrieval failed:', error);
    throw error;
  }
}