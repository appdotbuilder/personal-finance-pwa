import { db } from '../db';
import { recurringRulesTable, transactionsTable, accountsTable } from '../db/schema';
import { type Transaction, type RecurringFrequency } from '../schema';
import { eq, and, lte, isNull, or, gte, sql, SQL } from 'drizzle-orm';

// Helper function to calculate next occurrence based on frequency
function calculateNextOccurrence(currentDate: Date, frequency: RecurringFrequency, intervalCount: number): Date {
  const nextDate = new Date(currentDate);
  
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
  }
  
  return nextDate;
}

export async function applyRecurringTransactions(userId?: string): Promise<{ processed: number; transactions: Transaction[] }> {
  try {
    const now = new Date();
    
    // Build query conditions
    const baseConditions = [
      eq(recurringRulesTable.is_active, true),
      lte(recurringRulesTable.next_occurrence, now),
      isNull(recurringRulesTable.deleted_at),
      or(
        isNull(recurringRulesTable.end_date),
        gte(recurringRulesTable.end_date, now)
      )
    ];
    
    // Add user filter if provided
    if (userId) {
      baseConditions.push(eq(recurringRulesTable.user_id, userId));
    }
    
    // Execute query with proper type handling
    const dueRules = await db
      .select()
      .from(recurringRulesTable)
      .where(and(...baseConditions))
      .execute();
    
    const createdTransactions: Transaction[] = [];
    
    // Process each due rule
    for (const rule of dueRules) {
      try {
        // Skip if rule has ended
        if (rule.end_date && rule.next_occurrence > rule.end_date) {
          continue;
        }
        
        // Create the transaction
        const transactionResult = await db.insert(transactionsTable)
          .values({
            user_id: rule.user_id,
            account_id: rule.account_id,
            to_account_id: rule.to_account_id,
            category_id: rule.category_id,
            transaction_type: rule.transaction_type,
            amount: rule.amount,
            description: rule.description,
            notes: `Recurring transaction from rule: ${rule.description}`,
            transaction_date: rule.next_occurrence,
            recurring_rule_id: rule.id,
            tags: []
          })
          .returning()
          .execute();
        
        const newTransaction = transactionResult[0];
        
        // Update account balances based on transaction type
        if (rule.transaction_type === 'income') {
          // Get current balance and update
          const currentAccount = await db.select()
            .from(accountsTable)
            .where(eq(accountsTable.id, rule.account_id))
            .execute();
          
          if (currentAccount[0]) {
            const newBalance = parseFloat(currentAccount[0].balance) + parseFloat(rule.amount);
            await db.update(accountsTable)
              .set({ balance: newBalance.toString() })
              .where(eq(accountsTable.id, rule.account_id))
              .execute();
          }
        } else if (rule.transaction_type === 'expense') {
          // Get current balance and update
          const currentAccount = await db.select()
            .from(accountsTable)
            .where(eq(accountsTable.id, rule.account_id))
            .execute();
          
          if (currentAccount[0]) {
            const newBalance = parseFloat(currentAccount[0].balance) - parseFloat(rule.amount);
            await db.update(accountsTable)
              .set({ balance: newBalance.toString() })
              .where(eq(accountsTable.id, rule.account_id))
              .execute();
          }
        } else if (rule.transaction_type === 'transfer' && rule.to_account_id) {
          // Handle transfer - decrease from source, increase to destination
          const [sourceAccount, destAccount] = await Promise.all([
            db.select().from(accountsTable).where(eq(accountsTable.id, rule.account_id)).execute(),
            db.select().from(accountsTable).where(eq(accountsTable.id, rule.to_account_id)).execute()
          ]);
          
          if (sourceAccount[0] && destAccount[0]) {
            const newSourceBalance = parseFloat(sourceAccount[0].balance) - parseFloat(rule.amount);
            const newDestBalance = parseFloat(destAccount[0].balance) + parseFloat(rule.amount);
            
            await Promise.all([
              db.update(accountsTable)
                .set({ balance: newSourceBalance.toString() })
                .where(eq(accountsTable.id, rule.account_id))
                .execute(),
              db.update(accountsTable)
                .set({ balance: newDestBalance.toString() })
                .where(eq(accountsTable.id, rule.to_account_id))
                .execute()
            ]);
          }
        }
        
        // Calculate next occurrence
        const nextOccurrence = calculateNextOccurrence(
          rule.next_occurrence, 
          rule.frequency, 
          rule.interval_count
        );
        
        // Check if next occurrence is beyond end date
        const shouldDeactivate = rule.end_date && nextOccurrence > rule.end_date;
        
        // Update the recurring rule
        await db.update(recurringRulesTable)
          .set({
            next_occurrence: nextOccurrence,
            is_active: shouldDeactivate ? false : rule.is_active,
            updated_at: now
          })
          .where(eq(recurringRulesTable.id, rule.id))
          .execute();
        
        // Convert numeric fields back to numbers and handle tags properly
        const transactionWithNumbers: Transaction = {
          ...newTransaction,
          amount: parseFloat(newTransaction.amount),
          tags: Array.isArray(newTransaction.tags) ? newTransaction.tags as string[] : []
        };
        
        createdTransactions.push(transactionWithNumbers);
        
      } catch (error) {
        console.error(`Failed to process recurring rule ${rule.id}:`, error);
        // Continue processing other rules even if one fails
      }
    }
    
    return {
      processed: createdTransactions.length,
      transactions: createdTransactions
    };
    
  } catch (error) {
    console.error('Apply recurring transactions failed:', error);
    throw error;
  }
}