import { db } from '../db';
import { 
  accountsTable, 
  categoriesTable, 
  transactionsTable, 
  budgetsTable, 
  savingsGoalsTable 
} from '../db/schema';
import { randomUUID } from 'crypto';

export async function createDemoData(userId: string): Promise<{ success: boolean; message: string }> {
  try {
    // Create demo accounts
    const accounts = await createDemoAccounts(userId);
    
    // Create demo categories
    const categories = await createDemoCategories(userId);
    
    // Create transactions for the past 6 months
    await createDemoTransactions(userId, accounts, categories);
    
    // Create demo budgets
    await createDemoBudgets(userId, categories);
    
    // Create demo savings goals
    await createDemoSavingsGoals(userId, accounts);
    
    return {
      success: true,
      message: 'Demo data created successfully'
    };
  } catch (error) {
    console.error('Demo data creation failed:', error);
    throw error;
  }
}

async function createDemoAccounts(userId: string) {
  const accountsData = [
    {
      id: randomUUID(),
      user_id: userId,
      name: 'BCA Checking',
      account_type: 'checking' as const,
      balance: '15750000',
      initial_balance: '10000000',
      currency: 'IDR',
      color: '#0066CC',
      icon: 'bank',
      is_default: true,
    },
    {
      id: randomUUID(),
      user_id: userId,
      name: 'Mandiri Savings',
      account_type: 'savings' as const,
      balance: '25500000',
      initial_balance: '20000000',
      currency: 'IDR',
      color: '#FFB800',
      icon: 'piggy-bank',
      is_default: false,
    },
    {
      id: randomUUID(),
      user_id: userId,
      name: 'BNI Credit Card',
      account_type: 'credit' as const,
      balance: '-2850000',
      initial_balance: '0',
      currency: 'IDR',
      color: '#FF6B6B',
      icon: 'credit-card',
      is_default: false,
    },
    {
      id: randomUUID(),
      user_id: userId,
      name: 'Cash Wallet',
      account_type: 'cash' as const,
      balance: '750000',
      initial_balance: '500000',
      currency: 'IDR',
      color: '#4ECDC4',
      icon: 'wallet',
      is_default: false,
    }
  ];

  await db.insert(accountsTable).values(accountsData).execute();
  
  return accountsData.map(account => ({
    ...account,
    balance: parseFloat(account.balance),
    initial_balance: parseFloat(account.initial_balance)
  }));
}

async function createDemoCategories(userId: string) {
  const categoriesData = [
    // Income categories
    {
      id: randomUUID(),
      user_id: userId,
      name: 'Salary',
      category_type: 'income' as const,
      parent_id: null,
      color: '#27AE60',
      icon: 'briefcase',
      is_system: false,
    },
    {
      id: randomUUID(),
      user_id: userId,
      name: 'Freelance',
      category_type: 'income' as const,
      parent_id: null,
      color: '#2ECC71',
      icon: 'laptop',
      is_system: false,
    },
    {
      id: randomUUID(),
      user_id: userId,
      name: 'Investment',
      category_type: 'income' as const,
      parent_id: null,
      color: '#16A085',
      icon: 'trending-up',
      is_system: false,
    },
    // Expense categories
    {
      id: randomUUID(),
      user_id: userId,
      name: 'Food & Dining',
      category_type: 'expense' as const,
      parent_id: null,
      color: '#E74C3C',
      icon: 'utensils',
      is_system: false,
    },
    {
      id: randomUUID(),
      user_id: userId,
      name: 'Transportation',
      category_type: 'expense' as const,
      parent_id: null,
      color: '#9B59B6',
      icon: 'car',
      is_system: false,
    },
    {
      id: randomUUID(),
      user_id: userId,
      name: 'Shopping',
      category_type: 'expense' as const,
      parent_id: null,
      color: '#F39C12',
      icon: 'shopping-bag',
      is_system: false,
    },
    {
      id: randomUUID(),
      user_id: userId,
      name: 'Bills & Utilities',
      category_type: 'expense' as const,
      parent_id: null,
      color: '#34495E',
      icon: 'file-text',
      is_system: false,
    },
    {
      id: randomUUID(),
      user_id: userId,
      name: 'Entertainment',
      category_type: 'expense' as const,
      parent_id: null,
      color: '#E67E22',
      icon: 'music',
      is_system: false,
    },
    {
      id: randomUUID(),
      user_id: userId,
      name: 'Healthcare',
      category_type: 'expense' as const,
      parent_id: null,
      color: '#1ABC9C',
      icon: 'heart',
      is_system: false,
    }
  ];

  await db.insert(categoriesTable).values(categoriesData).execute();
  
  return categoriesData;
}

async function createDemoTransactions(userId: string, accounts: any[], categories: any[]) {
  const transactions = [];
  const now = new Date();
  
  // Get category groups
  const incomeCategories = categories.filter(c => c.category_type === 'income');
  const expenseCategories = categories.filter(c => c.category_type === 'expense');
  
  // Create transactions for the past 6 months
  for (let month = 0; month < 6; month++) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - month, 1);
    const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
    const isCurrentMonth = monthDate.getMonth() === now.getMonth() && monthDate.getFullYear() === now.getFullYear();
    const maxDay = isCurrentMonth ? Math.min(daysInMonth, now.getDate()) : daysInMonth;
    
    // Monthly salary (only if day 25 is within valid range)
    if (25 <= maxDay) {
      transactions.push({
        id: randomUUID(),
        user_id: userId,
        account_id: accounts[0].id, // BCA Checking
        to_account_id: null,
        category_id: incomeCategories.find(c => c.name === 'Salary')?.id,
        transaction_type: 'income' as const,
        amount: '12000000', // 12M IDR salary
        description: 'Monthly Salary',
        notes: null,
        receipt_url: null,
        transaction_date: new Date(monthDate.getFullYear(), monthDate.getMonth(), 25),
        recurring_rule_id: null,
        tags: ['salary', 'regular'],
      });
    }

    // Freelance income (random, but ensure date is valid)
    if (Math.random() > 0.4) {
      const freelanceDay = Math.floor(Math.random() * maxDay) + 1;
      transactions.push({
        id: randomUUID(),
        user_id: userId,
        account_id: accounts[0].id,
        to_account_id: null,
        category_id: incomeCategories.find(c => c.name === 'Freelance')?.id,
        transaction_type: 'income' as const,
        amount: (Math.random() * 5000000 + 2000000).toString(), // 2-7M IDR
        description: 'Freelance Project',
        notes: null,
        receipt_url: null,
        transaction_date: new Date(monthDate.getFullYear(), monthDate.getMonth(), freelanceDay),
        recurring_rule_id: null,
        tags: ['freelance'],
      });
    }

    // Create daily expenses
      
    for (let day = 1; day <= maxDay; day++) {
      const transactionDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
      
      // Skip weekends for some transactions
      const isWeekend = transactionDate.getDay() === 0 || transactionDate.getDay() === 6;
      
      // Food expenses (daily, but less on weekends)
      if (!isWeekend || Math.random() > 0.3) {
        const accountId = Math.random() > 0.7 ? accounts[3].id : accounts[0].id; // Cash or checking
        transactions.push({
          id: randomUUID(),
          user_id: userId,
          account_id: accountId,
          to_account_id: null,
          category_id: expenseCategories.find(c => c.name === 'Food & Dining')?.id,
          transaction_type: 'expense' as const,
          amount: (Math.random() * 200000 + 50000).toString(), // 50-250K IDR
          description: Math.random() > 0.5 ? 'Lunch' : 'Dinner',
          notes: null,
          receipt_url: null,
          transaction_date: transactionDate,
          recurring_rule_id: null,
          tags: ['food'],
        });
      }

      // Transportation (workdays mostly)
      if (!isWeekend && Math.random() > 0.2) {
        transactions.push({
          id: randomUUID(),
          user_id: userId,
          account_id: accounts[3].id, // Cash
          to_account_id: null,
          category_id: expenseCategories.find(c => c.name === 'Transportation')?.id,
          transaction_type: 'expense' as const,
          amount: (Math.random() * 50000 + 25000).toString(), // 25-75K IDR
          description: Math.random() > 0.5 ? 'Gojek' : 'Grab',
          notes: null,
          receipt_url: null,
          transaction_date: transactionDate,
          recurring_rule_id: null,
          tags: ['transport', 'ojol'],
        });
      }

      // Random shopping
      if (Math.random() > 0.85) {
        transactions.push({
          id: randomUUID(),
          user_id: userId,
          account_id: accounts[2].id, // Credit card
          to_account_id: null,
          category_id: expenseCategories.find(c => c.name === 'Shopping')?.id,
          transaction_type: 'expense' as const,
          amount: (Math.random() * 1500000 + 200000).toString(), // 200K-1.7M IDR
          description: 'Online Shopping',
          notes: null,
          receipt_url: null,
          transaction_date: transactionDate,
          recurring_rule_id: null,
          tags: ['shopping', 'online'],
        });
      }
    }

    // Monthly bills
    const billCategories = expenseCategories.find(c => c.name === 'Bills & Utilities');
    const billTransactions = [
      { description: 'Electricity Bill', amount: '450000' },
      { description: 'Internet Bill', amount: '350000' },
      { description: 'Mobile Phone Bill', amount: '150000' },
      { description: 'Water Bill', amount: '125000' }
    ];

    billTransactions.forEach((bill, index) => {
      const billDay = 5 + index;
      if (billDay <= maxDay) {
        transactions.push({
          id: randomUUID(),
          user_id: userId,
          account_id: accounts[0].id,
          to_account_id: null,
          category_id: billCategories?.id,
          transaction_type: 'expense' as const,
          amount: bill.amount,
          description: bill.description,
          notes: null,
          receipt_url: null,
          transaction_date: new Date(monthDate.getFullYear(), monthDate.getMonth(), billDay),
          recurring_rule_id: null,
          tags: ['bills', 'monthly'],
        });
      }
    });
  }

  // Insert transactions in batches to avoid memory issues
  const batchSize = 100;
  for (let i = 0; i < transactions.length; i += batchSize) {
    const batch = transactions.slice(i, i + batchSize);
    await db.insert(transactionsTable).values(batch).execute();
  }
}

async function createDemoBudgets(userId: string, categories: any[]) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  const expenseCategories = categories.filter(c => c.category_type === 'expense');
  
  const budgets = [
    {
      id: randomUUID(),
      user_id: userId,
      category_id: expenseCategories.find(c => c.name === 'Food & Dining')?.id!,
      name: 'Monthly Food Budget',
      amount: '3000000', // 3M IDR
      spent: '2450000', // 2.45M IDR spent
      period_start: monthStart,
      period_end: monthEnd,
      is_active: true,
    },
    {
      id: randomUUID(),
      user_id: userId,
      category_id: expenseCategories.find(c => c.name === 'Transportation')?.id!,
      name: 'Transportation Budget',
      amount: '1500000', // 1.5M IDR
      spent: '1200000', // 1.2M IDR spent
      period_start: monthStart,
      period_end: monthEnd,
      is_active: true,
    },
    {
      id: randomUUID(),
      user_id: userId,
      category_id: expenseCategories.find(c => c.name === 'Entertainment')?.id!,
      name: 'Entertainment Budget',
      amount: '1000000', // 1M IDR
      spent: '650000', // 650K IDR spent
      period_start: monthStart,
      period_end: monthEnd,
      is_active: true,
    }
  ];

  await db.insert(budgetsTable).values(budgets).execute();
}

async function createDemoSavingsGoals(userId: string, accounts: any[]) {
  const now = new Date();
  const nextYear = now.getFullYear() + 1;
  
  const savingsGoals = [
    {
      id: randomUUID(),
      user_id: userId,
      account_id: accounts[1].id, // Mandiri Savings
      name: 'Emergency Fund',
      description: 'Build emergency fund for 6 months expenses',
      target_amount: '60000000', // 60M IDR
      current_amount: '25500000', // Current savings balance
      target_date: new Date(nextYear, 11, 31), // End of next year
      status: 'active' as const,
    },
    {
      id: randomUUID(),
      user_id: userId,
      account_id: accounts[1].id,
      name: 'Vacation Fund',
      description: 'Save for family vacation to Bali',
      target_amount: '15000000', // 15M IDR
      current_amount: '8500000', // 8.5M IDR saved
      target_date: new Date(now.getFullYear(), now.getMonth() + 6, 1), // 6 months from now
      status: 'active' as const,
    },
    {
      id: randomUUID(),
      user_id: userId,
      account_id: accounts[1].id,
      name: 'New Laptop',
      description: 'Save for new MacBook Pro',
      target_amount: '25000000', // 25M IDR
      current_amount: '12000000', // 12M IDR saved
      target_date: new Date(now.getFullYear(), now.getMonth() + 9, 15), // 9 months from now
      status: 'active' as const,
    }
  ];

  await db.insert(savingsGoalsTable).values(savingsGoals).execute();
}