import { db } from '../db';
import { transactionsTable, budgetsTable, categoriesTable, accountsTable } from '../db/schema';
import { type AiInsight } from '../schema';
import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';

export async function getAiInsights(userId: string): Promise<AiInsight> {
  try {
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

    // Analyze spending patterns by getting transaction data with categories
    const recentTransactions = await db.select({
      amount: transactionsTable.amount,
      transaction_type: transactionsTable.transaction_type,
      transaction_date: transactionsTable.transaction_date,
      category_name: categoriesTable.name,
      category_type: categoriesTable.category_type
    })
    .from(transactionsTable)
    .leftJoin(categoriesTable, eq(transactionsTable.category_id, categoriesTable.id))
    .where(
      and(
        eq(transactionsTable.user_id, userId),
        gte(transactionsTable.transaction_date, threeMonthsAgo)
      )
    )
    .orderBy(desc(transactionsTable.transaction_date))
    .execute();

    // Get budget performance data
    const activeBudgets = await db.select({
      name: budgetsTable.name,
      amount: budgetsTable.amount,
      spent: budgetsTable.spent,
      period_start: budgetsTable.period_start,
      period_end: budgetsTable.period_end,
      category_name: categoriesTable.name
    })
    .from(budgetsTable)
    .leftJoin(categoriesTable, eq(budgetsTable.category_id, categoriesTable.id))
    .where(
      and(
        eq(budgetsTable.user_id, userId),
        eq(budgetsTable.is_active, true),
        lte(budgetsTable.period_start, now),
        gte(budgetsTable.period_end, now)
      )
    )
    .execute();

    // Get account balances
    const accounts = await db.select({
      name: accountsTable.name,
      balance: accountsTable.balance,
      account_type: accountsTable.account_type
    })
    .from(accountsTable)
    .where(eq(accountsTable.user_id, userId))
    .execute();

    // Convert numeric fields
    const processedTransactions = recentTransactions.map(t => ({
      ...t,
      amount: parseFloat(t.amount)
    }));

    const processedBudgets = activeBudgets.map(b => ({
      ...b,
      amount: parseFloat(b.amount),
      spent: parseFloat(b.spent)
    }));

    const processedAccounts = accounts.map(a => ({
      ...a,
      balance: parseFloat(a.balance)
    }));

    // Generate insights
    const spendingInsights = generateSpendingInsights(processedTransactions, currentMonth, previousMonth);
    const budgetRecommendations = generateBudgetRecommendations(processedBudgets, processedTransactions);
    const savingsSuggestions = generateSavingsSuggestions(processedTransactions, processedAccounts);
    const financialHealthScore = calculateFinancialHealthScore(
      processedTransactions,
      processedBudgets,
      processedAccounts
    );

    return {
      spending_insights: spendingInsights,
      budget_recommendations: budgetRecommendations,
      savings_suggestions: savingsSuggestions,
      financial_health_score: financialHealthScore,
      generated_at: now
    };

  } catch (error) {
    console.error('AI insights generation failed:', error);
    throw error;
  }
}

function generateSpendingInsights(
  transactions: Array<{
    amount: number;
    transaction_type: string;
    transaction_date: Date;
    category_name: string | null;
    category_type: string | null;
  }>,
  currentMonth: Date,
  previousMonth: Date
): string[] {
  const insights: string[] = [];
  
  // Calculate monthly spending by category
  const currentMonthExpenses = transactions.filter(t => 
    t.transaction_type === 'expense' && 
    t.transaction_date >= currentMonth
  );
  
  const previousMonthExpenses = transactions.filter(t => 
    t.transaction_type === 'expense' && 
    t.transaction_date >= previousMonth && 
    t.transaction_date < currentMonth
  );

  // Group by category
  const currentSpendingByCategory = groupByCategory(currentMonthExpenses);
  const previousSpendingByCategory = groupByCategory(previousMonthExpenses);

  // Compare spending patterns
  for (const [category, currentAmount] of Object.entries(currentSpendingByCategory)) {
    const previousAmount = previousSpendingByCategory[category] || 0;
    if (previousAmount > 0) {
      const changePercent = ((currentAmount - previousAmount) / previousAmount) * 100;
      
      if (changePercent > 20) {
        insights.push(`Your spending on ${category} has increased by ${Math.round(changePercent)}% this month`);
      } else if (changePercent < -20) {
        insights.push(`Your spending on ${category} has decreased by ${Math.round(Math.abs(changePercent))}% this month`);
      }
    }
  }

  // Check for high frequency small transactions (potential subscription waste)
  const smallTransactions = currentMonthExpenses.filter(t => t.amount < 50);
  if (smallTransactions.length > 10) {
    const totalSmall = smallTransactions.reduce((sum, t) => sum + t.amount, 0);
    insights.push(`You have ${smallTransactions.length} small transactions totaling $${totalSmall.toFixed(2)} - review for unused subscriptions`);
  }

  // Default insight if no patterns detected
  if (insights.length === 0) {
    const totalCurrentExpenses = currentMonthExpenses.reduce((sum, t) => sum + t.amount, 0);
    const totalPreviousExpenses = previousMonthExpenses.reduce((sum, t) => sum + t.amount, 0);
    
    if (totalPreviousExpenses > 0) {
      const overallChange = ((totalCurrentExpenses - totalPreviousExpenses) / totalPreviousExpenses) * 100;
      insights.push(`Your overall spending has ${overallChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(overallChange).toFixed(1)}% this month`);
    } else {
      insights.push('Start tracking your expenses to get personalized insights');
    }
  }

  return insights;
}

function generateBudgetRecommendations(
  budgets: Array<{
    name: string;
    amount: number;
    spent: number;
    category_name: string | null;
  }>,
  transactions: Array<{
    amount: number;
    transaction_type: string;
    category_name: string | null;
  }>
): string[] {
  const recommendations: string[] = [];

  // Check budget performance
  budgets.forEach(budget => {
    const usagePercent = (budget.spent / budget.amount) * 100;
    
    if (usagePercent > 90) {
      recommendations.push(`Your ${budget.name} budget is ${usagePercent.toFixed(0)}% used - consider reducing spending or increasing the budget`);
    } else if (usagePercent < 50) {
      recommendations.push(`Your ${budget.name} budget is only ${usagePercent.toFixed(0)}% used - you could allocate some funds elsewhere`);
    }
  });

  // Check for categories without budgets
  const expenseTransactions = transactions.filter(t => t.transaction_type === 'expense');
  const categoriesWithSpending = [...new Set(expenseTransactions.map(t => t.category_name).filter(Boolean))];
  const categoriesWithBudgets = new Set(budgets.map(b => b.category_name).filter(Boolean));
  
  const unbbudgetedCategories = categoriesWithSpending.filter(cat => !categoriesWithBudgets.has(cat));
  
  if (unbbudgetedCategories.length > 0) {
    recommendations.push(`Consider creating budgets for: ${unbbudgetedCategories.slice(0, 3).join(', ')}`);
  }

  // Default recommendation if no specific insights
  if (recommendations.length === 0) {
    if (budgets.length === 0) {
      recommendations.push('Start by creating budgets for your top spending categories');
    } else {
      recommendations.push('Your budgets are well-balanced - keep monitoring your spending patterns');
    }
  }

  return recommendations;
}

function generateSavingsSuggestions(
  transactions: Array<{
    amount: number;
    transaction_type: string;
    transaction_date: Date;
    category_name: string | null;
  }>,
  accounts: Array<{
    name: string;
    balance: number;
    account_type: string;
  }>
): string[] {
  const suggestions: string[] = [];

  // Calculate potential savings from high-spend categories
  const expenseTransactions = transactions.filter(t => t.transaction_type === 'expense');
  const spendingByCategory = groupByCategory(expenseTransactions);
  
  // Find highest spending category
  const highestCategory = Object.entries(spendingByCategory)
    .sort(([,a], [,b]) => b - a)[0];
  
  if (highestCategory && highestCategory[1] > 200) {
    const potentialSavings = Math.round(highestCategory[1] * 0.1);
    suggestions.push(`You could save $${potentialSavings} by reducing your ${highestCategory[0]} expenses by 10%`);
  }

  // Check savings account balance
  const savingsAccounts = accounts.filter(a => a.account_type === 'savings');
  const totalSavings = savingsAccounts.reduce((sum, a) => sum + a.balance, 0);
  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
  
  if (totalBalance > 0) {
    const savingsRatio = (totalSavings / totalBalance) * 100;
    if (savingsRatio < 20) {
      suggestions.push('Consider increasing your savings rate to at least 20% of your total funds');
    }
  }

  // Emergency fund suggestion
  const monthlyExpenses = expenseTransactions
    .filter(t => t.transaction_date >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
    .reduce((sum, t) => sum + t.amount, 0);
  
  const emergencyFundTarget = monthlyExpenses * 6;
  if (totalSavings < emergencyFundTarget) {
    const needed = emergencyFundTarget - totalSavings;
    suggestions.push(`Build an emergency fund of $${emergencyFundTarget.toFixed(0)} - you need $${needed.toFixed(0)} more`);
  }

  // Default suggestion
  if (suggestions.length === 0) {
    suggestions.push('Consider automating regular transfers to your savings account');
  }

  return suggestions;
}

function calculateFinancialHealthScore(
  transactions: Array<{
    amount: number;
    transaction_type: string;
    transaction_date: Date;
  }>,
  budgets: Array<{
    amount: number;
    spent: number;
  }>,
  accounts: Array<{
    balance: number;
    account_type: string;
  }>
): number {
  let score = 50; // Base score

  // Income vs expenses ratio (30 points max)
  const recentTransactions = transactions.filter(t => 
    t.transaction_date >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  );
  
  const monthlyIncome = recentTransactions
    .filter(t => t.transaction_type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const monthlyExpenses = recentTransactions
    .filter(t => t.transaction_type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  if (monthlyIncome > 0) {
    const expenseRatio = monthlyExpenses / monthlyIncome;
    if (expenseRatio < 0.5) score += 30;
    else if (expenseRatio < 0.7) score += 20;
    else if (expenseRatio < 0.9) score += 10;
    // No points if spending >= 90% of income
  }

  // Budget adherence (20 points max)
  if (budgets.length > 0) {
    const budgetPerformance: number[] = budgets.map(b => {
      const usagePercent = (b.spent / b.amount) * 100;
      if (usagePercent <= 80) return 1; // Good
      if (usagePercent <= 100) return 0.5; // Okay
      return 0; // Over budget
    });
    
    const avgPerformance = budgetPerformance.reduce((sum, p) => sum + p, 0) / budgets.length;
    score += Math.round(avgPerformance * 20);
  }

  // Savings ratio (20 points max)
  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
  const savingsBalance = accounts
    .filter(a => a.account_type === 'savings')
    .reduce((sum, a) => sum + a.balance, 0);

  if (totalBalance > 0) {
    const savingsRatio = savingsBalance / totalBalance;
    if (savingsRatio >= 0.3) score += 20;
    else if (savingsRatio >= 0.2) score += 15;
    else if (savingsRatio >= 0.1) score += 10;
    else if (savingsRatio > 0) score += 5;
  }

  return Math.min(100, Math.max(0, score));
}

function groupByCategory(
  transactions: Array<{
    amount: number;
    category_name: string | null;
  }>
): Record<string, number> {
  return transactions.reduce((acc, t) => {
    const category = t.category_name || 'Uncategorized';
    acc[category] = (acc[category] || 0) + t.amount;
    return acc;
  }, {} as Record<string, number>);
}