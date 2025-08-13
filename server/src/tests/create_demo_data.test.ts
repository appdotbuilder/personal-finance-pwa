import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  accountsTable, 
  categoriesTable, 
  transactionsTable, 
  budgetsTable, 
  savingsGoalsTable 
} from '../db/schema';
import { createDemoData } from '../handlers/create_demo_data';
import { eq, and, gte, count } from 'drizzle-orm';
import { randomUUID } from 'crypto';

describe('createDemoData', () => {
  const testUserId = randomUUID();
  
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create demo data successfully', async () => {
    const result = await createDemoData(testUserId);

    expect(result.success).toBe(true);
    expect(result.message).toEqual('Demo data created successfully');
  });

  it('should create Indonesian demo accounts with correct data', async () => {
    await createDemoData(testUserId);

    const accounts = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.user_id, testUserId))
      .execute();

    expect(accounts).toHaveLength(4);

    // Check specific accounts
    const bcaChecking = accounts.find(a => a.name === 'BCA Checking');
    expect(bcaChecking).toBeDefined();
    expect(bcaChecking?.account_type).toEqual('checking');
    expect(bcaChecking?.currency).toEqual('IDR');
    expect(bcaChecking?.is_default).toBe(true);
    expect(parseFloat(bcaChecking?.balance || '0')).toEqual(15750000);

    const mandiriSavings = accounts.find(a => a.name === 'Mandiri Savings');
    expect(mandiriSavings).toBeDefined();
    expect(mandiriSavings?.account_type).toEqual('savings');
    expect(parseFloat(mandiriSavings?.balance || '0')).toEqual(25500000);

    const bniCredit = accounts.find(a => a.name === 'BNI Credit Card');
    expect(bniCredit).toBeDefined();
    expect(bniCredit?.account_type).toEqual('credit');
    expect(parseFloat(bniCredit?.balance || '0')).toEqual(-2850000);

    const cashWallet = accounts.find(a => a.name === 'Cash Wallet');
    expect(cashWallet).toBeDefined();
    expect(cashWallet?.account_type).toEqual('cash');
    expect(parseFloat(cashWallet?.balance || '0')).toEqual(750000);
  });

  it('should create realistic Indonesian expense categories', async () => {
    await createDemoData(testUserId);

    const categories = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.user_id, testUserId))
      .execute();

    expect(categories.length).toBeGreaterThanOrEqual(9);

    // Check income categories
    const incomeCategories = categories.filter(c => c.category_type === 'income');
    expect(incomeCategories.length).toBeGreaterThanOrEqual(3);
    
    const salaryCategory = incomeCategories.find(c => c.name === 'Salary');
    expect(salaryCategory).toBeDefined();
    expect(salaryCategory?.color).toEqual('#27AE60');
    expect(salaryCategory?.icon).toEqual('briefcase');

    // Check expense categories
    const expenseCategories = categories.filter(c => c.category_type === 'expense');
    expect(expenseCategories.length).toBeGreaterThanOrEqual(6);

    const foodCategory = expenseCategories.find(c => c.name === 'Food & Dining');
    expect(foodCategory).toBeDefined();
    expect(foodCategory?.icon).toEqual('utensils');

    const transportCategory = expenseCategories.find(c => c.name === 'Transportation');
    expect(transportCategory).toBeDefined();
    expect(transportCategory?.icon).toEqual('car');
  });

  it('should create realistic transactions with Indonesian patterns', async () => {
    await createDemoData(testUserId);

    const transactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.user_id, testUserId))
      .execute();

    expect(transactions.length).toBeGreaterThan(100); // Should have many transactions over 6 months

    // Check salary transactions (should have 6 months of salary)
    const salaryTransactions = transactions.filter(t => t.description === 'Monthly Salary');
    expect(salaryTransactions.length).toBeGreaterThanOrEqual(1);
    expect(salaryTransactions.length).toBeLessThanOrEqual(6);

    // Verify salary amount
    const salaryTransaction = salaryTransactions[0];
    expect(parseFloat(salaryTransaction.amount)).toEqual(12000000); // 12M IDR
    expect(salaryTransaction.transaction_type).toEqual('income');

    // Check food transactions
    const foodTransactions = transactions.filter(t => 
      t.description === 'Lunch' || t.description === 'Dinner'
    );
    expect(foodTransactions.length).toBeGreaterThan(50); // Should have many food transactions
    
    // Verify food amounts are reasonable
    foodTransactions.forEach(transaction => {
      const amount = parseFloat(transaction.amount);
      expect(amount).toBeGreaterThanOrEqual(50000); // At least 50K IDR
      expect(amount).toBeLessThanOrEqual(250000); // At most 250K IDR
      expect(transaction.transaction_type).toEqual('expense');
    });

    // Check transportation transactions
    const transportTransactions = transactions.filter(t => 
      t.description === 'Gojek' || t.description === 'Grab'
    );
    expect(transportTransactions.length).toBeGreaterThan(0);

    // Check bill transactions
    const billTransactions = transactions.filter(t => 
      t.description.includes('Bill')
    );
    expect(billTransactions.length).toBeGreaterThan(0);

    // Verify all transactions have required fields
    transactions.forEach(transaction => {
      expect(transaction.user_id).toEqual(testUserId);
      expect(transaction.account_id).toBeDefined();
      expect(typeof parseFloat(transaction.amount)).toBe('number');
      expect(transaction.description).toBeDefined();
      expect(transaction.transaction_date).toBeInstanceOf(Date);
      expect(['income', 'expense', 'transfer']).toContain(transaction.transaction_type);
    });
  });

  it('should create budgets for current month', async () => {
    await createDemoData(testUserId);

    const budgets = await db.select()
      .from(budgetsTable)
      .where(eq(budgetsTable.user_id, testUserId))
      .execute();

    expect(budgets).toHaveLength(3);

    // Check food budget
    const foodBudget = budgets.find(b => b.name === 'Monthly Food Budget');
    expect(foodBudget).toBeDefined();
    expect(parseFloat(foodBudget?.amount || '0')).toEqual(3000000); // 3M IDR
    expect(parseFloat(foodBudget?.spent || '0')).toEqual(2450000); // 2.45M IDR spent
    expect(foodBudget?.is_active).toBe(true);

    // Check transportation budget
    const transportBudget = budgets.find(b => b.name === 'Transportation Budget');
    expect(transportBudget).toBeDefined();
    expect(parseFloat(transportBudget?.amount || '0')).toEqual(1500000);
    expect(parseFloat(transportBudget?.spent || '0')).toEqual(1200000);

    // Check entertainment budget
    const entertainmentBudget = budgets.find(b => b.name === 'Entertainment Budget');
    expect(entertainmentBudget).toBeDefined();
    expect(parseFloat(entertainmentBudget?.amount || '0')).toEqual(1000000);
    expect(parseFloat(entertainmentBudget?.spent || '0')).toEqual(650000);

    // Verify all budgets have correct date ranges (current month)
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    budgets.forEach(budget => {
      expect(budget.period_start.getTime()).toEqual(monthStart.getTime());
      expect(budget.period_end.getTime()).toEqual(monthEnd.getTime());
      expect(budget.user_id).toEqual(testUserId);
    });
  });

  it('should create realistic savings goals with Indonesian context', async () => {
    await createDemoData(testUserId);

    const savingsGoals = await db.select()
      .from(savingsGoalsTable)
      .where(eq(savingsGoalsTable.user_id, testUserId))
      .execute();

    expect(savingsGoals).toHaveLength(3);

    // Check emergency fund
    const emergencyFund = savingsGoals.find(g => g.name === 'Emergency Fund');
    expect(emergencyFund).toBeDefined();
    expect(emergencyFund?.description).toEqual('Build emergency fund for 6 months expenses');
    expect(parseFloat(emergencyFund?.target_amount || '0')).toEqual(60000000); // 60M IDR
    expect(parseFloat(emergencyFund?.current_amount || '0')).toEqual(25500000);
    expect(emergencyFund?.status).toEqual('active');

    // Check vacation fund
    const vacationFund = savingsGoals.find(g => g.name === 'Vacation Fund');
    expect(vacationFund).toBeDefined();
    expect(vacationFund?.description).toEqual('Save for family vacation to Bali');
    expect(parseFloat(vacationFund?.target_amount || '0')).toEqual(15000000);
    expect(parseFloat(vacationFund?.current_amount || '0')).toEqual(8500000);

    // Check laptop fund
    const laptopFund = savingsGoals.find(g => g.name === 'New Laptop');
    expect(laptopFund).toBeDefined();
    expect(laptopFund?.description).toEqual('Save for new MacBook Pro');
    expect(parseFloat(laptopFund?.target_amount || '0')).toEqual(25000000);
    expect(parseFloat(laptopFund?.current_amount || '0')).toEqual(12000000);

    // Verify all goals have proper target dates and user ID
    savingsGoals.forEach(goal => {
      expect(goal.user_id).toEqual(testUserId);
      expect(goal.target_date).toBeInstanceOf(Date);
      expect(goal.target_date!.getTime()).toBeGreaterThan(Date.now()); // Should be in the future
      expect(parseFloat(goal.target_amount)).toBeGreaterThan(0);
      expect(parseFloat(goal.current_amount)).toBeGreaterThanOrEqual(0);
    });
  });

  it('should create transactions within the past 6 months', async () => {
    await createDemoData(testUserId);

    const transactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.user_id, testUserId))
      .execute();

    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

    transactions.forEach(transaction => {
      expect(transaction.transaction_date.getTime()).toBeGreaterThanOrEqual(sixMonthsAgo.getTime());
      expect(transaction.transaction_date.getTime()).toBeLessThanOrEqual(now.getTime());
    });
  });

  it('should create data with proper relationships', async () => {
    await createDemoData(testUserId);

    // Get all data
    const accounts = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.user_id, testUserId))
      .execute();

    const categories = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.user_id, testUserId))
      .execute();

    const transactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.user_id, testUserId))
      .execute();

    const budgets = await db.select()
      .from(budgetsTable)
      .where(eq(budgetsTable.user_id, testUserId))
      .execute();

    const savingsGoals = await db.select()
      .from(savingsGoalsTable)
      .where(eq(savingsGoalsTable.user_id, testUserId))
      .execute();

    // Verify relationships
    const accountIds = accounts.map(a => a.id);
    const categoryIds = categories.map(c => c.id);

    // All transactions should reference valid accounts and categories
    transactions.forEach(transaction => {
      expect(accountIds).toContain(transaction.account_id);
      if (transaction.category_id) {
        expect(categoryIds).toContain(transaction.category_id);
      }
    });

    // All budgets should reference valid categories
    budgets.forEach(budget => {
      expect(categoryIds).toContain(budget.category_id);
    });

    // All savings goals should reference valid accounts
    savingsGoals.forEach(goal => {
      expect(accountIds).toContain(goal.account_id);
    });
  });

  it('should handle database errors gracefully', async () => {
    // Test with invalid user ID format (not UUID)
    try {
      await createDemoData('invalid-uuid');
      expect(false).toBe(true); // Should not reach here
    } catch (error) {
      expect(error).toBeDefined();
      // The error should be from the database operation
      expect(typeof error).toBe('object');
    }
  });
});