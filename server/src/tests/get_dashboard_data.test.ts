import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { accountsTable, transactionsTable, budgetsTable, savingsGoalsTable, categoriesTable } from '../db/schema';
import { getDashboardData } from '../handlers/get_dashboard_data';

const testUserId = '550e8400-e29b-41d4-a716-446655440000';
const otherUserId = '550e8400-e29b-41d4-a716-446655440001';

describe('getDashboardData', () => {
    beforeEach(createDB);
    afterEach(resetDB);

    it('should return empty dashboard data for user with no data', async () => {
        const result = await getDashboardData(testUserId);

        expect(result.accounts).toEqual([]);
        expect(result.recentTransactions).toEqual([]);
        expect(result.monthlyBudgets).toEqual([]);
        expect(result.savingsGoals).toEqual([]);
        expect(result.monthlyIncome).toEqual(0);
        expect(result.monthlyExpenses).toEqual(0);
        expect(result.netWorth).toEqual(0);
    });

    it('should return complete dashboard data for user with all data types', async () => {
        // Create test accounts
        const account1 = await db.insert(accountsTable)
            .values({
                user_id: testUserId,
                name: 'Checking Account',
                account_type: 'checking',
                balance: '1500.50',
                initial_balance: '1000.00'
            })
            .returning()
            .execute();

        const account2 = await db.insert(accountsTable)
            .values({
                user_id: testUserId,
                name: 'Savings Account',
                account_type: 'savings',
                balance: '5000.00',
                initial_balance: '4500.00'
            })
            .returning()
            .execute();

        // Create test category
        const category = await db.insert(categoriesTable)
            .values({
                user_id: testUserId,
                name: 'Groceries',
                category_type: 'expense'
            })
            .returning()
            .execute();

        // Create transactions for current month
        const now = new Date();
        const currentMonthDate = new Date(now.getFullYear(), now.getMonth(), 15);
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 15);

        // Income transaction (current month)
        await db.insert(transactionsTable)
            .values({
                user_id: testUserId,
                account_id: account1[0].id,
                category_id: category[0].id,
                transaction_type: 'income',
                amount: '3000.00',
                description: 'Salary',
                transaction_date: currentMonthDate
            })
            .execute();

        // Expense transaction (current month)
        await db.insert(transactionsTable)
            .values({
                user_id: testUserId,
                account_id: account1[0].id,
                category_id: category[0].id,
                transaction_type: 'expense',
                amount: '150.75',
                description: 'Grocery Shopping',
                transaction_date: currentMonthDate
            })
            .execute();

        // Old transaction (last month) - should not affect monthly totals
        await db.insert(transactionsTable)
            .values({
                user_id: testUserId,
                account_id: account1[0].id,
                category_id: category[0].id,
                transaction_type: 'expense',
                amount: '200.00',
                description: 'Old Expense',
                transaction_date: lastMonthDate
            })
            .execute();

        // Create budget for current month
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        await db.insert(budgetsTable)
            .values({
                user_id: testUserId,
                category_id: category[0].id,
                name: 'Monthly Groceries',
                amount: '500.00',
                spent: '150.75',
                period_start: monthStart,
                period_end: monthEnd
            })
            .execute();

        // Create savings goal
        await db.insert(savingsGoalsTable)
            .values({
                user_id: testUserId,
                account_id: account2[0].id,
                name: 'Emergency Fund',
                target_amount: '10000.00',
                current_amount: '5000.00'
            })
            .execute();

        const result = await getDashboardData(testUserId);

        // Verify accounts
        expect(result.accounts).toHaveLength(2);
        expect(result.accounts[0].name).toEqual('Checking Account');
        expect(result.accounts[0].balance).toEqual(1500.50);
        expect(result.accounts[1].name).toEqual('Savings Account');
        expect(result.accounts[1].balance).toEqual(5000.00);

        // Verify recent transactions (should include all transactions, ordered by date)
        expect(result.recentTransactions).toHaveLength(3);
        expect(result.recentTransactions[0].amount).toEqual(3000.00); // Most recent
        expect(result.recentTransactions[1].amount).toEqual(150.75);
        expect(result.recentTransactions[2].amount).toEqual(200.00); // Oldest

        // Verify monthly budgets
        expect(result.monthlyBudgets).toHaveLength(1);
        expect(result.monthlyBudgets[0].name).toEqual('Monthly Groceries');
        expect(result.monthlyBudgets[0].amount).toEqual(500.00);
        expect(result.monthlyBudgets[0].spent).toEqual(150.75);

        // Verify savings goals
        expect(result.savingsGoals).toHaveLength(1);
        expect(result.savingsGoals[0].name).toEqual('Emergency Fund');
        expect(result.savingsGoals[0].target_amount).toEqual(10000.00);
        expect(result.savingsGoals[0].current_amount).toEqual(5000.00);

        // Verify monthly calculations (current month only)
        expect(result.monthlyIncome).toEqual(3000.00);
        expect(result.monthlyExpenses).toEqual(150.75);

        // Verify net worth (sum of account balances)
        expect(result.netWorth).toEqual(6500.50);
    });

    it('should only return data for the specified user', async () => {
        // Create account for test user
        await db.insert(accountsTable)
            .values({
                user_id: testUserId,
                name: 'Test Account',
                account_type: 'checking',
                balance: '1000.00',
                initial_balance: '1000.00'
            })
            .execute();

        // Create account for other user
        await db.insert(accountsTable)
            .values({
                user_id: otherUserId,
                name: 'Other Account',
                account_type: 'savings',
                balance: '2000.00',
                initial_balance: '2000.00'
            })
            .execute();

        const result = await getDashboardData(testUserId);

        expect(result.accounts).toHaveLength(1);
        expect(result.accounts[0].name).toEqual('Test Account');
        expect(result.netWorth).toEqual(1000.00);
    });

    it('should exclude deleted records from dashboard data', async () => {
        // Create active account
        const activeAccount = await db.insert(accountsTable)
            .values({
                user_id: testUserId,
                name: 'Active Account',
                account_type: 'checking',
                balance: '1000.00',
                initial_balance: '1000.00'
            })
            .returning()
            .execute();

        // Create deleted account
        await db.insert(accountsTable)
            .values({
                user_id: testUserId,
                name: 'Deleted Account',
                account_type: 'savings',
                balance: '2000.00',
                initial_balance: '2000.00',
                deleted_at: new Date()
            })
            .execute();

        // Create category
        const category = await db.insert(categoriesTable)
            .values({
                user_id: testUserId,
                name: 'Test Category',
                category_type: 'expense'
            })
            .returning()
            .execute();

        // Create active transaction
        await db.insert(transactionsTable)
            .values({
                user_id: testUserId,
                account_id: activeAccount[0].id,
                category_id: category[0].id,
                transaction_type: 'expense',
                amount: '100.00',
                description: 'Active Transaction',
                transaction_date: new Date()
            })
            .execute();

        // Create deleted transaction
        await db.insert(transactionsTable)
            .values({
                user_id: testUserId,
                account_id: activeAccount[0].id,
                category_id: category[0].id,
                transaction_type: 'expense',
                amount: '200.00',
                description: 'Deleted Transaction',
                transaction_date: new Date(),
                deleted_at: new Date()
            })
            .execute();

        const result = await getDashboardData(testUserId);

        // Should only include active records
        expect(result.accounts).toHaveLength(1);
        expect(result.accounts[0].name).toEqual('Active Account');
        expect(result.recentTransactions).toHaveLength(1);
        expect(result.recentTransactions[0].description).toEqual('Active Transaction');
        expect(result.netWorth).toEqual(1000.00); // Only active account balance
    });

    it('should correctly filter budgets by current month period overlap', async () => {
        const now = new Date();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth() - 1 + 1, 0);

        // Create category
        const category = await db.insert(categoriesTable)
            .values({
                user_id: testUserId,
                name: 'Test Category',
                category_type: 'expense'
            })
            .returning()
            .execute();

        // Create current month budget
        await db.insert(budgetsTable)
            .values({
                user_id: testUserId,
                category_id: category[0].id,
                name: 'Current Month Budget',
                amount: '500.00',
                period_start: currentMonthStart,
                period_end: currentMonthEnd
            })
            .execute();

        // Create last month budget (should not be included)
        await db.insert(budgetsTable)
            .values({
                user_id: testUserId,
                category_id: category[0].id,
                name: 'Last Month Budget',
                amount: '400.00',
                period_start: lastMonthStart,
                period_end: lastMonthEnd
            })
            .execute();

        // Create inactive budget (should not be included)
        await db.insert(budgetsTable)
            .values({
                user_id: testUserId,
                category_id: category[0].id,
                name: 'Inactive Budget',
                amount: '300.00',
                period_start: currentMonthStart,
                period_end: currentMonthEnd,
                is_active: false
            })
            .execute();

        const result = await getDashboardData(testUserId);

        expect(result.monthlyBudgets).toHaveLength(1);
        expect(result.monthlyBudgets[0].name).toEqual('Current Month Budget');
        expect(result.monthlyBudgets[0].amount).toEqual(500.00);
    });

    it('should only include active savings goals', async () => {
        // Create account
        const account = await db.insert(accountsTable)
            .values({
                user_id: testUserId,
                name: 'Test Account',
                account_type: 'savings',
                balance: '1000.00',
                initial_balance: '1000.00'
            })
            .returning()
            .execute();

        // Create active goal
        await db.insert(savingsGoalsTable)
            .values({
                user_id: testUserId,
                account_id: account[0].id,
                name: 'Active Goal',
                target_amount: '5000.00',
                current_amount: '1000.00',
                status: 'active'
            })
            .execute();

        // Create completed goal (should not be included)
        await db.insert(savingsGoalsTable)
            .values({
                user_id: testUserId,
                account_id: account[0].id,
                name: 'Completed Goal',
                target_amount: '2000.00',
                current_amount: '2000.00',
                status: 'completed'
            })
            .execute();

        // Create paused goal (should not be included)
        await db.insert(savingsGoalsTable)
            .values({
                user_id: testUserId,
                account_id: account[0].id,
                name: 'Paused Goal',
                target_amount: '3000.00',
                current_amount: '500.00',
                status: 'paused'
            })
            .execute();

        const result = await getDashboardData(testUserId);

        expect(result.savingsGoals).toHaveLength(1);
        expect(result.savingsGoals[0].name).toEqual('Active Goal');
        expect(result.savingsGoals[0].status).toEqual('active');
    });

    it('should correctly calculate net worth from multiple accounts', async () => {
        // Create accounts with different balances
        await db.insert(accountsTable)
            .values({
                user_id: testUserId,
                name: 'Checking',
                account_type: 'checking',
                balance: '1500.25',
                initial_balance: '1000.00'
            })
            .execute();

        await db.insert(accountsTable)
            .values({
                user_id: testUserId,
                name: 'Savings',
                account_type: 'savings',
                balance: '5000.75',
                initial_balance: '4000.00'
            })
            .execute();

        await db.insert(accountsTable)
            .values({
                user_id: testUserId,
                name: 'Credit Card',
                account_type: 'credit',
                balance: '-500.50', // Negative balance for credit
                initial_balance: '0.00'
            })
            .execute();

        const result = await getDashboardData(testUserId);

        expect(result.accounts).toHaveLength(3);
        expect(result.netWorth).toEqual(6000.50); // 1500.25 + 5000.75 + (-500.50)
    });
});