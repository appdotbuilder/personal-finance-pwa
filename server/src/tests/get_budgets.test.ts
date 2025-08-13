import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  profilesTable, 
  accountsTable, 
  categoriesTable, 
  budgetsTable, 
  transactionsTable 
} from '../db/schema';
import { getBudgets } from '../handlers/get_budgets';
import { eq } from 'drizzle-orm';

// Test user - using valid UUID format
const testUserId = '550e8400-e29b-41d4-a716-446655440000';

// Test data
const testProfile = {
  user_id: testUserId,
  display_name: 'Test User',
  email: 'test@example.com',
  currency: 'IDR',
  locale: 'id-ID',
  timezone: 'Asia/Jakarta'
};

const testAccount = {
  user_id: testUserId,
  name: 'Test Account',
  account_type: 'checking' as const,
  initial_balance: '1000.00',
  currency: 'IDR'
};

const testCategory = {
  user_id: testUserId,
  name: 'Food & Dining',
  category_type: 'expense' as const
};

describe('getBudgets', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when user has no budgets', async () => {
    const result = await getBudgets('550e8400-e29b-41d4-a716-446655440001');
    expect(result).toEqual([]);
  });

  it('should fetch active budgets with correct spending calculations', async () => {
    // Create prerequisite data
    const [profile] = await db.insert(profilesTable).values(testProfile).returning().execute();
    const [account] = await db.insert(accountsTable).values(testAccount).returning().execute();
    const [category] = await db.insert(categoriesTable).values(testCategory).returning().execute();

    // Create budget
    const budgetData = {
      user_id: testUserId,
      category_id: category.id,
      name: 'Monthly Food Budget',
      amount: '500.00',
      period_start: new Date('2024-01-01'),
      period_end: new Date('2024-01-31'),
      is_active: true
    };

    const [budget] = await db.insert(budgetsTable).values(budgetData).returning().execute();

    // Create some expense transactions within budget period
    const transactionData = [
      {
        user_id: testUserId,
        account_id: account.id,
        category_id: category.id,
        transaction_type: 'expense' as const,
        amount: '100.00',
        description: 'Grocery shopping',
        transaction_date: new Date('2024-01-15')
      },
      {
        user_id: testUserId,
        account_id: account.id,
        category_id: category.id,
        transaction_type: 'expense' as const,
        amount: '50.00',
        description: 'Restaurant',
        transaction_date: new Date('2024-01-20')
      }
    ];

    await db.insert(transactionsTable).values(transactionData).execute();

    const result = await getBudgets(testUserId);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: budget.id,
      user_id: testUserId,
      category_id: category.id,
      name: 'Monthly Food Budget',
      amount: 500,
      spent: 150, // 100 + 50
      is_active: true
    });
    expect(result[0].period_start).toBeInstanceOf(Date);
    expect(result[0].period_end).toBeInstanceOf(Date);
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeInstanceOf(Date);
  });

  it('should only include expenses within budget period', async () => {
    // Create prerequisite data
    const [profile] = await db.insert(profilesTable).values(testProfile).returning().execute();
    const [account] = await db.insert(accountsTable).values(testAccount).returning().execute();
    const [category] = await db.insert(categoriesTable).values(testCategory).returning().execute();

    // Create budget for January
    const budgetData = {
      user_id: testUserId,
      category_id: category.id,
      name: 'January Food Budget',
      amount: '300.00',
      period_start: new Date('2024-01-01'),
      period_end: new Date('2024-01-31'),
      is_active: true
    };

    await db.insert(budgetsTable).values(budgetData).returning().execute();

    // Create transactions - some in period, some outside
    const transactionData = [
      {
        user_id: testUserId,
        account_id: account.id,
        category_id: category.id,
        transaction_type: 'expense' as const,
        amount: '75.00',
        description: 'January expense',
        transaction_date: new Date('2024-01-15')
      },
      {
        user_id: testUserId,
        account_id: account.id,
        category_id: category.id,
        transaction_type: 'expense' as const,
        amount: '50.00',
        description: 'December expense (before period)',
        transaction_date: new Date('2023-12-25')
      },
      {
        user_id: testUserId,
        account_id: account.id,
        category_id: category.id,
        transaction_type: 'expense' as const,
        amount: '100.00',
        description: 'February expense (after period)',
        transaction_date: new Date('2024-02-05')
      }
    ];

    await db.insert(transactionsTable).values(transactionData).execute();

    const result = await getBudgets(testUserId);

    expect(result).toHaveLength(1);
    expect(result[0].spent).toEqual(75); // Only January expense
  });

  it('should exclude income transactions from spending calculations', async () => {
    // Create prerequisite data
    const [profile] = await db.insert(profilesTable).values(testProfile).returning().execute();
    const [account] = await db.insert(accountsTable).values(testAccount).returning().execute();
    const [category] = await db.insert(categoriesTable).values(testCategory).returning().execute();

    // Create budget
    const budgetData = {
      user_id: testUserId,
      category_id: category.id,
      name: 'Test Budget',
      amount: '200.00',
      period_start: new Date('2024-01-01'),
      period_end: new Date('2024-01-31'),
      is_active: true
    };

    await db.insert(budgetsTable).values(budgetData).returning().execute();

    // Create mixed transaction types
    const transactionData = [
      {
        user_id: testUserId,
        account_id: account.id,
        category_id: category.id,
        transaction_type: 'expense' as const,
        amount: '60.00',
        description: 'Expense transaction',
        transaction_date: new Date('2024-01-15')
      },
      {
        user_id: testUserId,
        account_id: account.id,
        category_id: category.id,
        transaction_type: 'income' as const,
        amount: '500.00',
        description: 'Income transaction (should be ignored)',
        transaction_date: new Date('2024-01-20')
      },
      {
        user_id: testUserId,
        account_id: account.id,
        category_id: category.id,
        transaction_type: 'transfer' as const,
        amount: '100.00',
        description: 'Transfer transaction (should be ignored)',
        transaction_date: new Date('2024-01-25')
      }
    ];

    await db.insert(transactionsTable).values(transactionData).execute();

    const result = await getBudgets(testUserId);

    expect(result).toHaveLength(1);
    expect(result[0].spent).toEqual(60); // Only expense transaction
  });

  it('should exclude inactive budgets', async () => {
    // Create prerequisite data
    const [profile] = await db.insert(profilesTable).values(testProfile).returning().execute();
    const [account] = await db.insert(accountsTable).values(testAccount).returning().execute();
    const [category] = await db.insert(categoriesTable).values(testCategory).returning().execute();

    // Create both active and inactive budgets
    const budgetData = [
      {
        user_id: testUserId,
        category_id: category.id,
        name: 'Active Budget',
        amount: '300.00',
        period_start: new Date('2024-01-01'),
        period_end: new Date('2024-01-31'),
        is_active: true
      },
      {
        user_id: testUserId,
        category_id: category.id,
        name: 'Inactive Budget',
        amount: '200.00',
        period_start: new Date('2024-01-01'),
        period_end: new Date('2024-01-31'),
        is_active: false
      }
    ];

    await db.insert(budgetsTable).values(budgetData).execute();

    const result = await getBudgets(testUserId);

    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('Active Budget');
  });

  it('should exclude deleted budgets and categories', async () => {
    // Create prerequisite data
    const [profile] = await db.insert(profilesTable).values(testProfile).returning().execute();
    const [account] = await db.insert(accountsTable).values(testAccount).returning().execute();
    const [category] = await db.insert(categoriesTable).values(testCategory).returning().execute();
    
    // Create another category that will be deleted
    const [deletedCategory] = await db.insert(categoriesTable).values({
      ...testCategory,
      name: 'Deleted Category'
    }).returning().execute();

    // Create budgets
    const budgetData = [
      {
        user_id: testUserId,
        category_id: category.id,
        name: 'Regular Budget',
        amount: '300.00',
        period_start: new Date('2024-01-01'),
        period_end: new Date('2024-01-31'),
        is_active: true
      },
      {
        user_id: testUserId,
        category_id: deletedCategory.id,
        name: 'Budget with Deleted Category',
        amount: '200.00',
        period_start: new Date('2024-01-01'),
        period_end: new Date('2024-01-31'),
        is_active: true
      }
    ];

    const [regularBudget, budgetWithDeletedCategory] = await db.insert(budgetsTable)
      .values(budgetData).returning().execute();

    // Delete the category
    await db.update(categoriesTable)
      .set({ deleted_at: new Date() })
      .where(eq(categoriesTable.id, deletedCategory.id))
      .execute();

    // Delete one budget
    await db.update(budgetsTable)
      .set({ deleted_at: new Date() })
      .where(eq(budgetsTable.id, budgetWithDeletedCategory.id))
      .execute();

    const result = await getBudgets(testUserId);

    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('Regular Budget');
  });

  it('should handle zero spending correctly', async () => {
    // Create prerequisite data
    const [profile] = await db.insert(profilesTable).values(testProfile).returning().execute();
    const [account] = await db.insert(accountsTable).values(testAccount).returning().execute();
    const [category] = await db.insert(categoriesTable).values(testCategory).returning().execute();

    // Create budget with no transactions
    const budgetData = {
      user_id: testUserId,
      category_id: category.id,
      name: 'Unused Budget',
      amount: '250.00',
      period_start: new Date('2024-01-01'),
      period_end: new Date('2024-01-31'),
      is_active: true
    };

    await db.insert(budgetsTable).values(budgetData).returning().execute();

    const result = await getBudgets(testUserId);

    expect(result).toHaveLength(1);
    expect(result[0].spent).toEqual(0);
    expect(result[0].amount).toEqual(250);
  });

  it('should handle multiple budgets with different categories', async () => {
    // Create prerequisite data
    const [profile] = await db.insert(profilesTable).values(testProfile).returning().execute();
    const [account] = await db.insert(accountsTable).values(testAccount).returning().execute();
    
    // Create multiple categories
    const categoryData = [
      {
        user_id: testUserId,
        name: 'Food',
        category_type: 'expense' as const
      },
      {
        user_id: testUserId,
        name: 'Transportation',
        category_type: 'expense' as const
      }
    ];
    
    const [foodCategory, transportCategory] = await db.insert(categoriesTable)
      .values(categoryData).returning().execute();

    // Create budgets for different categories
    const budgetData = [
      {
        user_id: testUserId,
        category_id: foodCategory.id,
        name: 'Food Budget',
        amount: '400.00',
        period_start: new Date('2024-01-01'),
        period_end: new Date('2024-01-31'),
        is_active: true
      },
      {
        user_id: testUserId,
        category_id: transportCategory.id,
        name: 'Transport Budget',
        amount: '200.00',
        period_start: new Date('2024-01-01'),
        period_end: new Date('2024-01-31'),
        is_active: true
      }
    ];

    await db.insert(budgetsTable).values(budgetData).execute();

    // Create transactions for different categories
    const transactionData = [
      {
        user_id: testUserId,
        account_id: account.id,
        category_id: foodCategory.id,
        transaction_type: 'expense' as const,
        amount: '120.00',
        description: 'Food expense',
        transaction_date: new Date('2024-01-15')
      },
      {
        user_id: testUserId,
        account_id: account.id,
        category_id: transportCategory.id,
        transaction_type: 'expense' as const,
        amount: '80.00',
        description: 'Transport expense',
        transaction_date: new Date('2024-01-20')
      }
    ];

    await db.insert(transactionsTable).values(transactionData).execute();

    const result = await getBudgets(testUserId);

    expect(result).toHaveLength(2);
    
    const foodBudget = result.find(b => b.name === 'Food Budget');
    const transportBudget = result.find(b => b.name === 'Transport Budget');
    
    expect(foodBudget).toBeDefined();
    expect(foodBudget?.amount).toEqual(400);
    expect(foodBudget?.spent).toEqual(120);
    
    expect(transportBudget).toBeDefined();
    expect(transportBudget?.amount).toEqual(200);
    expect(transportBudget?.spent).toEqual(80);
  });
});