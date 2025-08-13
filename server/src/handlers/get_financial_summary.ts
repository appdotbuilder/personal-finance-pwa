import { db } from '../db';
import { 
  transactionsTable, 
  accountsTable, 
  categoriesTable, 
  budgetsTable 
} from '../db/schema';
import { type GetFinancialSummaryInput, type FinancialSummary } from '../schema';
import { eq, and, gte, lte, sum, SQL } from 'drizzle-orm';

export async function getFinancialSummary(input: GetFinancialSummaryInput, userId: string): Promise<FinancialSummary> {
  try {
    const { start_date, end_date, account_id } = input;

    // Build base conditions
    const baseConditions: SQL<unknown>[] = [
      eq(transactionsTable.user_id, userId),
      gte(transactionsTable.transaction_date, start_date),
      lte(transactionsTable.transaction_date, end_date)
    ];

    // Add account filter if specified
    if (account_id) {
      baseConditions.push(eq(transactionsTable.account_id, account_id));
    }

    // Calculate total income and expenses
    const incomeQuery = db.select({
      total: sum(transactionsTable.amount)
    })
    .from(transactionsTable)
    .where(and(
      ...baseConditions,
      eq(transactionsTable.transaction_type, 'income')
    ));

    const expenseQuery = db.select({
      total: sum(transactionsTable.amount)
    })
    .from(transactionsTable)
    .where(and(
      ...baseConditions,
      eq(transactionsTable.transaction_type, 'expense')
    ));

    const [incomeResult, expenseResult] = await Promise.all([
      incomeQuery.execute(),
      expenseQuery.execute()
    ]);

    const total_income = parseFloat(incomeResult[0]?.total || '0');
    const total_expenses = parseFloat(expenseResult[0]?.total || '0');
    const net_income = total_income - total_expenses;

    // Get account balances (filtered if account_id specified)
    const accountConditions: SQL<unknown>[] = [eq(accountsTable.user_id, userId)];
    
    if (account_id) {
      accountConditions.push(eq(accountsTable.id, account_id));
    }

    const accountBalancesQuery = db.select({
      account_id: accountsTable.id,
      account_name: accountsTable.name,
      balance: accountsTable.balance
    })
    .from(accountsTable)
    .where(accountConditions.length === 1 ? accountConditions[0] : and(...accountConditions));

    const accountBalancesResult = await accountBalancesQuery.execute();
    const account_balances = accountBalancesResult.map(account => ({
      account_id: account.account_id,
      account_name: account.account_name,
      balance: parseFloat(account.balance)
    }));

    // Get expense breakdown by category
    const expenseByCategoryQuery = db.select({
      category_id: categoriesTable.id,
      category_name: categoriesTable.name,
      amount: sum(transactionsTable.amount)
    })
    .from(transactionsTable)
    .innerJoin(categoriesTable, eq(transactionsTable.category_id, categoriesTable.id))
    .where(and(
      ...baseConditions,
      eq(transactionsTable.transaction_type, 'expense')
    ))
    .groupBy(categoriesTable.id, categoriesTable.name);

    const expenseByCategoryResult = await expenseByCategoryQuery.execute();
    
    const expense_by_category = expenseByCategoryResult.map(item => {
      const amount = parseFloat(item.amount || '0');
      const percentage = total_expenses > 0 ? (amount / total_expenses) * 100 : 0;
      
      return {
        category_id: item.category_id,
        category_name: item.category_name,
        amount,
        percentage: Math.round(percentage * 100) / 100 // Round to 2 decimal places
      };
    });

    // Get budget status (active budgets within the date range)
    const budgetStatusQuery = db.select({
      budget_id: budgetsTable.id,
      budget_name: budgetsTable.name,
      allocated: budgetsTable.amount,
      spent: budgetsTable.spent
    })
    .from(budgetsTable)
    .where(and(
      eq(budgetsTable.user_id, userId),
      eq(budgetsTable.is_active, true),
      // Budget overlaps with query period
      lte(budgetsTable.period_start, end_date),
      gte(budgetsTable.period_end, start_date)
    ));

    const budgetStatusResult = await budgetStatusQuery.execute();
    
    const budget_status = budgetStatusResult.map(budget => {
      const allocated = parseFloat(budget.allocated);
      const spent = parseFloat(budget.spent);
      const remaining = allocated - spent;
      const percentage_used = allocated > 0 ? (spent / allocated) * 100 : 0;

      return {
        budget_id: budget.budget_id,
        budget_name: budget.budget_name,
        allocated,
        spent,
        remaining,
        percentage_used: Math.round(percentage_used * 100) / 100 // Round to 2 decimal places
      };
    });

    return {
      total_income,
      total_expenses,
      net_income,
      account_balances,
      expense_by_category,
      budget_status
    };

  } catch (error) {
    console.error('Financial summary generation failed:', error);
    throw error;
  }
}