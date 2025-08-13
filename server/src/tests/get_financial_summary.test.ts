import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  profilesTable, 
  accountsTable, 
  categoriesTable, 
  transactionsTable,
  budgetsTable
} from '../db/schema';
import { type GetFinancialSummaryInput } from '../schema';
import { getFinancialSummary } from '../handlers/get_financial_summary';

// Test data - using proper UUID format
const testUserId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const testProfileId = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const testAccountId1 = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const testAccountId2 = 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const testCategoryId1 = 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const testCategoryId2 = 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const testBudgetId = 'a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

// Date setup for testing
const testDate = new Date('2024-01-15');
const startDate = new Date('2024-01-01');
const endDate = new Date('2024-01-31');
const outsideRangeDate = new Date('2024-02-15');

describe('getFinancialSummary', () => {
  beforeEach(async () => {
    await createDB();
    
    // Create test profile
    await db.insert(profilesTable).values({
      id: testProfileId,
      user_id: testUserId,
      display_name: 'Test User',
      email: 'test@example.com'
    }).execute();

    // Create test accounts
    await db.insert(accountsTable).values([
      {
        id: testAccountId1,
        user_id: testUserId,
        name: 'Checking Account',
        account_type: 'checking',
        balance: '5000.00',
        initial_balance: '3000.00'
      },
      {
        id: testAccountId2,
        user_id: testUserId,
        name: 'Savings Account',
        account_type: 'savings',
        balance: '10000.00',
        initial_balance: '10000.00'
      }
    ]).execute();

    // Create test categories
    await db.insert(categoriesTable).values([
      {
        id: testCategoryId1,
        user_id: testUserId,
        name: 'Food & Dining',
        category_type: 'expense'
      },
      {
        id: testCategoryId2,
        user_id: testUserId,
        name: 'Salary',
        category_type: 'income'
      }
    ]).execute();
  });

  afterEach(resetDB);

  it('should calculate financial summary with income and expenses', async () => {
    // Create test transactions
    await db.insert(transactionsTable).values([
      {
        user_id: testUserId,
        account_id: testAccountId1,
        category_id: testCategoryId2,
        transaction_type: 'income',
        amount: '3000.00',
        description: 'Salary',
        transaction_date: testDate,
        tags: []
      },
      {
        user_id: testUserId,
        account_id: testAccountId1,
        category_id: testCategoryId1,
        transaction_type: 'expense',
        amount: '500.00',
        description: 'Groceries',
        transaction_date: testDate,
        tags: []
      },
      {
        user_id: testUserId,
        account_id: testAccountId1,
        category_id: testCategoryId1,
        transaction_type: 'expense',
        amount: '300.00',
        description: 'Restaurant',
        transaction_date: testDate,
        tags: []
      }
    ]).execute();

    const input: GetFinancialSummaryInput = {
      start_date: startDate,
      end_date: endDate
    };

    const result = await getFinancialSummary(input, testUserId);

    // Verify totals
    expect(result.total_income).toBe(3000);
    expect(result.total_expenses).toBe(800);
    expect(result.net_income).toBe(2200);

    // Verify account balances
    expect(result.account_balances).toHaveLength(2);
    const checkingAccount = result.account_balances.find(a => a.account_id === testAccountId1);
    const savingsAccount = result.account_balances.find(a => a.account_id === testAccountId2);
    
    expect(checkingAccount?.account_name).toBe('Checking Account');
    expect(checkingAccount?.balance).toBe(5000);
    expect(savingsAccount?.account_name).toBe('Savings Account');
    expect(savingsAccount?.balance).toBe(10000);

    // Verify expense breakdown by category
    expect(result.expense_by_category).toHaveLength(1);
    expect(result.expense_by_category[0].category_name).toBe('Food & Dining');
    expect(result.expense_by_category[0].amount).toBe(800);
    expect(result.expense_by_category[0].percentage).toBe(100);

    // Verify budget status (should be empty as no budgets created)
    expect(result.budget_status).toHaveLength(0);
  });

  it('should handle date range filtering correctly', async () => {
    // Create transactions inside and outside date range
    await db.insert(transactionsTable).values([
      {
        user_id: testUserId,
        account_id: testAccountId1,
        category_id: testCategoryId2,
        transaction_type: 'income',
        amount: '1000.00',
        description: 'Income in range',
        transaction_date: testDate, // Within range
        tags: []
      },
      {
        user_id: testUserId,
        account_id: testAccountId1,
        category_id: testCategoryId1,
        transaction_type: 'expense',
        amount: '500.00',
        description: 'Expense outside range',
        transaction_date: outsideRangeDate, // Outside range
        tags: []
      }
    ]).execute();

    const input: GetFinancialSummaryInput = {
      start_date: startDate,
      end_date: endDate
    };

    const result = await getFinancialSummary(input, testUserId);

    // Only transactions within date range should be included
    expect(result.total_income).toBe(1000);
    expect(result.total_expenses).toBe(0);
    expect(result.net_income).toBe(1000);
    expect(result.expense_by_category).toHaveLength(0);
  });

  it('should filter by specific account when account_id is provided', async () => {
    // Create transactions in different accounts
    await db.insert(transactionsTable).values([
      {
        user_id: testUserId,
        account_id: testAccountId1,
        category_id: testCategoryId2,
        transaction_type: 'income',
        amount: '1000.00',
        description: 'Income account 1',
        transaction_date: testDate,
        tags: []
      },
      {
        user_id: testUserId,
        account_id: testAccountId2,
        category_id: testCategoryId1,
        transaction_type: 'expense',
        amount: '300.00',
        description: 'Expense account 2',
        transaction_date: testDate,
        tags: []
      }
    ]).execute();

    const input: GetFinancialSummaryInput = {
      start_date: startDate,
      end_date: endDate,
      account_id: testAccountId1
    };

    const result = await getFinancialSummary(input, testUserId);

    // Only transactions from account 1 should be included
    expect(result.total_income).toBe(1000);
    expect(result.total_expenses).toBe(0);
    expect(result.net_income).toBe(1000);
    
    // Account balances should only include the specified account
    expect(result.account_balances).toHaveLength(1);
    expect(result.account_balances[0].account_id).toBe(testAccountId1);
  });

  it('should calculate budget status correctly', async () => {
    // Create test budget
    await db.insert(budgetsTable).values({
      id: testBudgetId,
      user_id: testUserId,
      category_id: testCategoryId1,
      name: 'Food Budget',
      amount: '1000.00',
      spent: '600.00',
      period_start: startDate,
      period_end: endDate,
      is_active: true
    }).execute();

    const input: GetFinancialSummaryInput = {
      start_date: startDate,
      end_date: endDate
    };

    const result = await getFinancialSummary(input, testUserId);

    expect(result.budget_status).toHaveLength(1);
    
    const budget = result.budget_status[0];
    expect(budget.budget_name).toBe('Food Budget');
    expect(budget.allocated).toBe(1000);
    expect(budget.spent).toBe(600);
    expect(budget.remaining).toBe(400);
    expect(budget.percentage_used).toBe(60);
  });

  it('should handle multiple categories with correct percentages', async () => {
    // Create additional category
    const testCategoryId3 = 'a2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    await db.insert(categoriesTable).values({
      id: testCategoryId3,
      user_id: testUserId,
      name: 'Transportation',
      category_type: 'expense'
    }).execute();

    // Create transactions in multiple expense categories
    await db.insert(transactionsTable).values([
      {
        user_id: testUserId,
        account_id: testAccountId1,
        category_id: testCategoryId1,
        transaction_type: 'expense',
        amount: '600.00', // 60% of total expenses
        description: 'Food expenses',
        transaction_date: testDate,
        tags: []
      },
      {
        user_id: testUserId,
        account_id: testAccountId1,
        category_id: testCategoryId3,
        transaction_type: 'expense',
        amount: '400.00', // 40% of total expenses
        description: 'Gas',
        transaction_date: testDate,
        tags: []
      }
    ]).execute();

    const input: GetFinancialSummaryInput = {
      start_date: startDate,
      end_date: endDate
    };

    const result = await getFinancialSummary(input, testUserId);

    expect(result.total_expenses).toBe(1000);
    expect(result.expense_by_category).toHaveLength(2);

    const foodCategory = result.expense_by_category.find(c => c.category_name === 'Food & Dining');
    const transportCategory = result.expense_by_category.find(c => c.category_name === 'Transportation');

    expect(foodCategory?.amount).toBe(600);
    expect(foodCategory?.percentage).toBe(60);
    expect(transportCategory?.amount).toBe(400);
    expect(transportCategory?.percentage).toBe(40);
  });

  it('should handle empty date range with zero values', async () => {
    const input: GetFinancialSummaryInput = {
      start_date: startDate,
      end_date: endDate
    };

    const result = await getFinancialSummary(input, testUserId);

    expect(result.total_income).toBe(0);
    expect(result.total_expenses).toBe(0);
    expect(result.net_income).toBe(0);
    expect(result.expense_by_category).toHaveLength(0);
    expect(result.budget_status).toHaveLength(0);
    
    // Account balances should still be returned
    expect(result.account_balances).toHaveLength(2);
  });

  it('should only include active budgets overlapping with date range', async () => {
    const futureBudgetId = 'a3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    const inactiveBudgetId = 'a4eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    
    // Create budgets with different conditions
    await db.insert(budgetsTable).values([
      {
        id: testBudgetId,
        user_id: testUserId,
        category_id: testCategoryId1,
        name: 'Current Budget',
        amount: '1000.00',
        spent: '300.00',
        period_start: startDate,
        period_end: endDate,
        is_active: true
      },
      {
        id: futureBudgetId,
        user_id: testUserId,
        category_id: testCategoryId1,
        name: 'Future Budget',
        amount: '800.00',
        spent: '0.00',
        period_start: new Date('2024-03-01'),
        period_end: new Date('2024-03-31'),
        is_active: true
      },
      {
        id: inactiveBudgetId,
        user_id: testUserId,
        category_id: testCategoryId1,
        name: 'Inactive Budget',
        amount: '500.00',
        spent: '100.00',
        period_start: startDate,
        period_end: endDate,
        is_active: false
      }
    ]).execute();

    const input: GetFinancialSummaryInput = {
      start_date: startDate,
      end_date: endDate
    };

    const result = await getFinancialSummary(input, testUserId);

    // Only the active budget overlapping with date range should be included
    expect(result.budget_status).toHaveLength(1);
    expect(result.budget_status[0].budget_name).toBe('Current Budget');
    expect(result.budget_status[0].allocated).toBe(1000);
    expect(result.budget_status[0].spent).toBe(300);
  });
});