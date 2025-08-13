import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { profilesTable, accountsTable, categoriesTable, transactionsTable, budgetsTable } from '../db/schema';
import { getAiInsights } from '../handlers/get_ai_insights';

const testUserId = '123e4567-e89b-12d3-a456-426614174000';

// Helper to create test data
const createProfile = async () => {
  return await db.insert(profilesTable)
    .values({
      user_id: testUserId,
      display_name: 'Test User',
      email: 'test@example.com'
    })
    .returning()
    .execute();
};

const createAccount = async (accountType: 'checking' | 'savings' = 'checking', balance: number = 1000) => {
  const result = await db.insert(accountsTable)
    .values({
      user_id: testUserId,
      name: `Test ${accountType} Account`,
      account_type: accountType,
      balance: balance.toString(),
      initial_balance: balance.toString()
    })
    .returning()
    .execute();
  
  return {
    ...result[0],
    balance: parseFloat(result[0].balance),
    initial_balance: parseFloat(result[0].initial_balance)
  };
};

const createCategory = async (name: string, type: 'income' | 'expense' = 'expense') => {
  return await db.insert(categoriesTable)
    .values({
      user_id: testUserId,
      name,
      category_type: type
    })
    .returning()
    .execute();
};

const createTransaction = async (
  accountId: string,
  categoryId: string,
  amount: number,
  type: 'income' | 'expense' = 'expense',
  daysAgo: number = 0
) => {
  const transactionDate = new Date();
  transactionDate.setDate(transactionDate.getDate() - daysAgo);
  
  const result = await db.insert(transactionsTable)
    .values({
      user_id: testUserId,
      account_id: accountId,
      category_id: categoryId,
      transaction_type: type,
      amount: amount.toString(),
      description: `Test ${type} transaction`,
      transaction_date: transactionDate
    })
    .returning()
    .execute();

  return {
    ...result[0],
    amount: parseFloat(result[0].amount)
  };
};

const createBudget = async (categoryId: string, amount: number, spent: number = 0) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const result = await db.insert(budgetsTable)
    .values({
      user_id: testUserId,
      category_id: categoryId,
      name: 'Test Budget',
      amount: amount.toString(),
      spent: spent.toString(),
      period_start: startOfMonth,
      period_end: endOfMonth
    })
    .returning()
    .execute();

  return {
    ...result[0],
    amount: parseFloat(result[0].amount),
    spent: parseFloat(result[0].spent)
  };
};

describe('getAiInsights', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should generate basic insights with minimal data', async () => {
    await createProfile();
    const account = await createAccount();
    const category = await createCategory('Food');
    await createTransaction(account.id, category[0].id, 100);

    const result = await getAiInsights(testUserId);

    expect(result.spending_insights.length).toBeGreaterThan(0);
    expect(result.budget_recommendations.length).toBeGreaterThan(0);
    expect(result.savings_suggestions.length).toBeGreaterThan(0);
    expect(result.financial_health_score).toBeGreaterThan(0);
    expect(result.financial_health_score).toBeLessThanOrEqual(100);
    expect(result.generated_at).toBeInstanceOf(Date);
  });

  it('should detect spending increases in categories', async () => {
    await createProfile();
    const account = await createAccount();
    const foodCategory = await createCategory('Food');

    // Current month spending: $200
    await createTransaction(account.id, foodCategory[0].id, 200, 'expense', 5);
    
    // Previous month spending: $100 (35+ days ago for previous month)
    await createTransaction(account.id, foodCategory[0].id, 100, 'expense', 35);

    const result = await getAiInsights(testUserId);

    expect(result.spending_insights.some(insight => 
      insight.includes('Food') && insight.includes('increased')
    )).toBe(true);
  });

  it('should detect spending decreases in categories', async () => {
    await createProfile();
    const account = await createAccount();
    const foodCategory = await createCategory('Food');

    // Current month spending: $50
    await createTransaction(account.id, foodCategory[0].id, 50, 'expense', 5);
    
    // Previous month spending: $200 (35+ days ago)
    await createTransaction(account.id, foodCategory[0].id, 200, 'expense', 35);

    const result = await getAiInsights(testUserId);

    expect(result.spending_insights.some(insight => 
      insight.includes('Food') && insight.includes('decreased')
    )).toBe(true);
  });

  it('should detect potential subscription waste with many small transactions', async () => {
    await createProfile();
    const account = await createAccount();
    const category = await createCategory('Entertainment');

    // Create 12 small transactions (< $50 each)
    for (let i = 0; i < 12; i++) {
      await createTransaction(account.id, category[0].id, 15, 'expense', i);
    }

    const result = await getAiInsights(testUserId);

    expect(result.spending_insights.some(insight => 
      insight.includes('small transactions') && insight.includes('subscriptions')
    )).toBe(true);
  });

  it('should provide budget recommendations for overused budgets', async () => {
    await createProfile();
    const account = await createAccount();
    const category = await createCategory('Food');
    
    // Create budget with 95% usage (spent $950 of $1000)
    await createBudget(category[0].id, 1000, 950);

    const result = await getAiInsights(testUserId);

    expect(result.budget_recommendations.some(rec => 
      rec.includes('95%') && rec.includes('reducing spending')
    )).toBe(true);
  });

  it('should provide budget recommendations for underused budgets', async () => {
    await createProfile();
    const account = await createAccount();
    const category = await createCategory('Entertainment');
    
    // Create budget with 30% usage (spent $300 of $1000)
    await createBudget(category[0].id, 1000, 300);

    const result = await getAiInsights(testUserId);

    expect(result.budget_recommendations.some(rec => 
      rec.includes('30%') && rec.includes('allocate some funds')
    )).toBe(true);
  });

  it('should recommend budgets for unbudgeted spending categories', async () => {
    await createProfile();
    const account = await createAccount();
    const foodCategory = await createCategory('Food');
    const entertainmentCategory = await createCategory('Entertainment');
    
    // Create spending without budgets
    await createTransaction(account.id, foodCategory[0].id, 100, 'expense', 5);
    await createTransaction(account.id, entertainmentCategory[0].id, 50, 'expense', 3);

    const result = await getAiInsights(testUserId);

    expect(result.budget_recommendations.some(rec => 
      rec.includes('creating budgets for')
    )).toBe(true);
  });

  it('should suggest savings based on high spending categories', async () => {
    await createProfile();
    const account = await createAccount();
    const foodCategory = await createCategory('Food');
    
    // Create high spending in food category ($500)
    await createTransaction(account.id, foodCategory[0].id, 500, 'expense', 5);

    const result = await getAiInsights(testUserId);

    expect(result.savings_suggestions.some(suggestion => 
      suggestion.includes('Food') && suggestion.includes('reducing')
    )).toBe(true);
  });

  it('should recommend increasing savings rate for low savings accounts', async () => {
    await createProfile();
    const checkingAccount = await createAccount('checking', 8000);
    const savingsAccount = await createAccount('savings', 1000); // Only 11% savings ratio

    const result = await getAiInsights(testUserId);

    expect(result.savings_suggestions.some(suggestion => 
      suggestion.includes('increasing your savings rate')
    )).toBe(true);
  });

  it('should suggest building emergency fund', async () => {
    await createProfile();
    const account = await createAccount('checking', 2000);
    const savingsAccount = await createAccount('savings', 500);
    const category = await createCategory('Food');
    
    // Create monthly expenses ($1000) that would require $6000 emergency fund
    await createTransaction(account.id, category[0].id, 1000, 'expense', 15);

    const result = await getAiInsights(testUserId);

    expect(result.savings_suggestions.some(suggestion => 
      suggestion.includes('emergency fund')
    )).toBe(true);
  });

  it('should calculate financial health score correctly', async () => {
    await createProfile();
    const account = await createAccount('checking', 5000);
    const savingsAccount = await createAccount('savings', 2000); // Good savings ratio
    const incomeCategory = await createCategory('Salary', 'income');
    const expenseCategory = await createCategory('Food', 'expense');
    
    // Create good income vs expense ratio
    await createTransaction(account.id, incomeCategory[0].id, 3000, 'income', 15);
    await createTransaction(account.id, expenseCategory[0].id, 1500, 'expense', 10);
    
    // Create well-managed budget
    await createBudget(expenseCategory[0].id, 2000, 1500); // 75% usage

    const result = await getAiInsights(testUserId);

    expect(result.financial_health_score).toBeGreaterThan(70); // Should be high score
    expect(result.financial_health_score).toBeLessThanOrEqual(100);
  });

  it('should handle users with no transactions gracefully', async () => {
    await createProfile();
    await createAccount();

    const result = await getAiInsights(testUserId);

    expect(result.spending_insights).toHaveLength(1);
    expect(result.spending_insights[0]).toContain('Start tracking');
    expect(result.budget_recommendations).toHaveLength(1);
    expect(result.savings_suggestions).toHaveLength(1);
    expect(result.financial_health_score).toBeGreaterThan(0);
  });

  it('should handle users with no budgets gracefully', async () => {
    await createProfile();
    const account = await createAccount();
    const category = await createCategory('Food');
    await createTransaction(account.id, category[0].id, 100, 'expense', 5);

    const result = await getAiInsights(testUserId);

    // Should either recommend creating budgets or suggest budgets for spending categories
    expect(result.budget_recommendations.some(rec => 
      rec.includes('Start by creating budgets') || rec.includes('creating budgets for')
    )).toBe(true);
  });

  it('should provide default savings suggestion when no specific patterns detected', async () => {
    await createProfile();
    const account = await createAccount('checking', 1000);
    const savingsAccount = await createAccount('savings', 500); // Good ratio
    const category = await createCategory('Food');
    
    // Small spending that won't trigger specific suggestions
    await createTransaction(account.id, category[0].id, 50, 'expense', 5);

    const result = await getAiInsights(testUserId);

    expect(result.savings_suggestions.some(suggestion => 
      suggestion.includes('automating regular transfers')
    )).toBe(true);
  });

  it('should calculate health score with mixed financial performance', async () => {
    await createProfile();
    const account = await createAccount('checking', 3000);
    const savingsAccount = await createAccount('savings', 500); // Low savings ratio
    const incomeCategory = await createCategory('Salary', 'income');
    const expenseCategory = await createCategory('Food', 'expense');
    
    // Poor income vs expense ratio (spending 80% of income)
    await createTransaction(account.id, incomeCategory[0].id, 2000, 'income', 15);
    await createTransaction(account.id, expenseCategory[0].id, 1600, 'expense', 10);
    
    // Over budget spending
    await createBudget(expenseCategory[0].id, 1000, 1600); // 160% usage

    const result = await getAiInsights(testUserId);

    expect(result.financial_health_score).toBeGreaterThan(30);
    expect(result.financial_health_score).toBeLessThanOrEqual(70); // Should be medium score
  });
});