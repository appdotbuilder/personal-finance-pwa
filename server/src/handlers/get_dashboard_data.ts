import { db } from '../db';
import { accountsTable, transactionsTable, budgetsTable, savingsGoalsTable } from '../db/schema';
import { type Account, type Transaction, type Budget, type SavingsGoal } from '../schema';
import { eq, desc, gte, lte, and, isNull, sum } from 'drizzle-orm';

interface DashboardData {
    accounts: Account[];
    recentTransactions: Transaction[];
    monthlyBudgets: Budget[];
    savingsGoals: SavingsGoal[];
    monthlyIncome: number;
    monthlyExpenses: number;
    netWorth: number;
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
    try {
        // Get current month boundaries
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        // Fetch all user accounts (active only)
        const accounts = await db.select()
            .from(accountsTable)
            .where(and(
                eq(accountsTable.user_id, userId),
                isNull(accountsTable.deleted_at)
            ))
            .execute();

        // Convert numeric fields for accounts
        const convertedAccounts: Account[] = accounts.map(account => ({
            ...account,
            balance: parseFloat(account.balance),
            initial_balance: parseFloat(account.initial_balance)
        }));

        // Fetch recent transactions (last 10)
        const recentTransactionsRaw = await db.select()
            .from(transactionsTable)
            .where(and(
                eq(transactionsTable.user_id, userId),
                isNull(transactionsTable.deleted_at)
            ))
            .orderBy(desc(transactionsTable.transaction_date))
            .limit(10)
            .execute();

        // Convert numeric fields for transactions
        const recentTransactions: Transaction[] = recentTransactionsRaw.map(transaction => ({
            ...transaction,
            amount: parseFloat(transaction.amount),
            tags: Array.isArray(transaction.tags) ? transaction.tags as string[] : []
        }));

        // Fetch active budgets for current month
        const monthlyBudgetsRaw = await db.select()
            .from(budgetsTable)
            .where(and(
                eq(budgetsTable.user_id, userId),
                eq(budgetsTable.is_active, true),
                lte(budgetsTable.period_start, monthEnd),
                gte(budgetsTable.period_end, monthStart),
                isNull(budgetsTable.deleted_at)
            ))
            .execute();

        // Convert numeric fields for budgets
        const monthlyBudgets: Budget[] = monthlyBudgetsRaw.map(budget => ({
            ...budget,
            amount: parseFloat(budget.amount),
            spent: parseFloat(budget.spent)
        }));

        // Fetch active savings goals
        const savingsGoalsRaw = await db.select()
            .from(savingsGoalsTable)
            .where(and(
                eq(savingsGoalsTable.user_id, userId),
                eq(savingsGoalsTable.status, 'active'),
                isNull(savingsGoalsTable.deleted_at)
            ))
            .execute();

        // Convert numeric fields for savings goals
        const savingsGoals: SavingsGoal[] = savingsGoalsRaw.map(goal => ({
            ...goal,
            target_amount: parseFloat(goal.target_amount),
            current_amount: parseFloat(goal.current_amount)
        }));

        // Calculate monthly income (current month)
        const incomeResult = await db.select({
            total: sum(transactionsTable.amount)
        })
            .from(transactionsTable)
            .where(and(
                eq(transactionsTable.user_id, userId),
                eq(transactionsTable.transaction_type, 'income'),
                gte(transactionsTable.transaction_date, monthStart),
                lte(transactionsTable.transaction_date, monthEnd),
                isNull(transactionsTable.deleted_at)
            ))
            .execute();

        const monthlyIncome = incomeResult[0]?.total ? parseFloat(incomeResult[0].total) : 0;

        // Calculate monthly expenses (current month)
        const expenseResult = await db.select({
            total: sum(transactionsTable.amount)
        })
            .from(transactionsTable)
            .where(and(
                eq(transactionsTable.user_id, userId),
                eq(transactionsTable.transaction_type, 'expense'),
                gte(transactionsTable.transaction_date, monthStart),
                lte(transactionsTable.transaction_date, monthEnd),
                isNull(transactionsTable.deleted_at)
            ))
            .execute();

        const monthlyExpenses = expenseResult[0]?.total ? parseFloat(expenseResult[0].total) : 0;

        // Calculate net worth (sum of all account balances)
        const netWorth = convertedAccounts.reduce((total, account) => total + account.balance, 0);

        return {
            accounts: convertedAccounts,
            recentTransactions,
            monthlyBudgets,
            savingsGoals,
            monthlyIncome,
            monthlyExpenses,
            netWorth
        };
    } catch (error) {
        console.error('Dashboard data retrieval failed:', error);
        throw error;
    }
}