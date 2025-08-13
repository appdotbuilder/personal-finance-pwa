import { z } from 'zod';

// Enums
export const transactionTypeEnum = z.enum(['income', 'expense', 'transfer']);
export const accountTypeEnum = z.enum(['checking', 'savings', 'credit', 'cash', 'investment']);
export const categoryTypeEnum = z.enum(['income', 'expense']);
export const recurringFrequencyEnum = z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']);
export const goalStatusEnum = z.enum(['active', 'completed', 'paused']);

// Base types
export type TransactionType = z.infer<typeof transactionTypeEnum>;
export type AccountType = z.infer<typeof accountTypeEnum>;
export type CategoryType = z.infer<typeof categoryTypeEnum>;
export type RecurringFrequency = z.infer<typeof recurringFrequencyEnum>;
export type GoalStatus = z.infer<typeof goalStatusEnum>;

// User Profile schema
export const profileSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  display_name: z.string(),
  email: z.string().email(),
  currency: z.string().default('IDR'),
  locale: z.string().default('id-ID'),
  timezone: z.string().default('Asia/Jakarta'),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  deleted_at: z.coerce.date().nullable()
});

export type Profile = z.infer<typeof profileSchema>;

// Account schema
export const accountSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string(),
  account_type: accountTypeEnum,
  balance: z.number(),
  initial_balance: z.number(),
  currency: z.string().default('IDR'),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  is_default: z.boolean().default(false),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  deleted_at: z.coerce.date().nullable()
});

export type Account = z.infer<typeof accountSchema>;

// Category schema
export const categorySchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string(),
  category_type: categoryTypeEnum,
  parent_id: z.string().uuid().nullable(),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  is_system: z.boolean().default(false),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  deleted_at: z.coerce.date().nullable()
});

export type Category = z.infer<typeof categorySchema>;

// Transaction schema
export const transactionSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  account_id: z.string().uuid(),
  to_account_id: z.string().uuid().nullable(),
  category_id: z.string().uuid().nullable(),
  transaction_type: transactionTypeEnum,
  amount: z.number(),
  description: z.string(),
  notes: z.string().nullable(),
  receipt_url: z.string().nullable(),
  transaction_date: z.coerce.date(),
  recurring_rule_id: z.string().uuid().nullable(),
  tags: z.array(z.string()).default([]),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  deleted_at: z.coerce.date().nullable()
});

export type Transaction = z.infer<typeof transactionSchema>;

// Budget schema
export const budgetSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  category_id: z.string().uuid(),
  name: z.string(),
  amount: z.number(),
  spent: z.number().default(0),
  period_start: z.coerce.date(),
  period_end: z.coerce.date(),
  is_active: z.boolean().default(true),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  deleted_at: z.coerce.date().nullable()
});

export type Budget = z.infer<typeof budgetSchema>;

// Recurring Rule schema
export const recurringRuleSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  account_id: z.string().uuid(),
  to_account_id: z.string().uuid().nullable(),
  category_id: z.string().uuid().nullable(),
  transaction_type: transactionTypeEnum,
  amount: z.number(),
  description: z.string(),
  frequency: recurringFrequencyEnum,
  interval_count: z.number().int().positive().default(1),
  start_date: z.coerce.date(),
  end_date: z.coerce.date().nullable(),
  next_occurrence: z.coerce.date(),
  is_active: z.boolean().default(true),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  deleted_at: z.coerce.date().nullable()
});

export type RecurringRule = z.infer<typeof recurringRuleSchema>;

// Savings Goal schema
export const savingsGoalSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  account_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  target_amount: z.number(),
  current_amount: z.number().default(0),
  target_date: z.coerce.date().nullable(),
  status: goalStatusEnum.default('active'),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  deleted_at: z.coerce.date().nullable()
});

export type SavingsGoal = z.infer<typeof savingsGoalSchema>;

// Audit Log schema
export const auditLogSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  entity_type: z.string(),
  entity_id: z.string().uuid(),
  action: z.string(),
  old_values: z.record(z.any()).nullable(),
  new_values: z.record(z.any()).nullable(),
  ip_address: z.string().nullable(),
  user_agent: z.string().nullable(),
  created_at: z.coerce.date()
});

export type AuditLog = z.infer<typeof auditLogSchema>;

// Input schemas for creating entities

export const createProfileInputSchema = z.object({
  display_name: z.string(),
  email: z.string().email(),
  currency: z.string().default('IDR'),
  locale: z.string().default('id-ID'),
  timezone: z.string().default('Asia/Jakarta')
});

export type CreateProfileInput = z.infer<typeof createProfileInputSchema>;

export const createAccountInputSchema = z.object({
  name: z.string(),
  account_type: accountTypeEnum,
  initial_balance: z.number().default(0),
  currency: z.string().default('IDR'),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  is_default: z.boolean().default(false)
});

export type CreateAccountInput = z.infer<typeof createAccountInputSchema>;

export const createCategoryInputSchema = z.object({
  name: z.string(),
  category_type: categoryTypeEnum,
  parent_id: z.string().uuid().nullable().optional(),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional()
});

export type CreateCategoryInput = z.infer<typeof createCategoryInputSchema>;

export const createTransactionInputSchema = z.object({
  account_id: z.string().uuid(),
  to_account_id: z.string().uuid().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  transaction_type: transactionTypeEnum,
  amount: z.number().positive(),
  description: z.string(),
  notes: z.string().nullable().optional(),
  receipt_url: z.string().nullable().optional(),
  transaction_date: z.coerce.date(),
  tags: z.array(z.string()).default([])
});

export type CreateTransactionInput = z.infer<typeof createTransactionInputSchema>;

export const createBudgetInputSchema = z.object({
  category_id: z.string().uuid(),
  name: z.string(),
  amount: z.number().positive(),
  period_start: z.coerce.date(),
  period_end: z.coerce.date()
});

export type CreateBudgetInput = z.infer<typeof createBudgetInputSchema>;

export const createRecurringRuleInputSchema = z.object({
  account_id: z.string().uuid(),
  to_account_id: z.string().uuid().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  transaction_type: transactionTypeEnum,
  amount: z.number().positive(),
  description: z.string(),
  frequency: recurringFrequencyEnum,
  interval_count: z.number().int().positive().default(1),
  start_date: z.coerce.date(),
  end_date: z.coerce.date().nullable().optional()
});

export type CreateRecurringRuleInput = z.infer<typeof createRecurringRuleInputSchema>;

export const createSavingsGoalInputSchema = z.object({
  account_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable().optional(),
  target_amount: z.number().positive(),
  target_date: z.coerce.date().nullable().optional()
});

export type CreateSavingsGoalInput = z.infer<typeof createSavingsGoalInputSchema>;

// Update input schemas

export const updateProfileInputSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string().optional(),
  currency: z.string().optional(),
  locale: z.string().optional(),
  timezone: z.string().optional()
});

export type UpdateProfileInput = z.infer<typeof updateProfileInputSchema>;

export const updateAccountInputSchema = z.object({
  id: z.string().uuid(),
  name: z.string().optional(),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  is_default: z.boolean().optional()
});

export type UpdateAccountInput = z.infer<typeof updateAccountInputSchema>;

export const updateCategoryInputSchema = z.object({
  id: z.string().uuid(),
  name: z.string().optional(),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional()
});

export type UpdateCategoryInput = z.infer<typeof updateCategoryInputSchema>;

export const updateTransactionInputSchema = z.object({
  id: z.string().uuid(),
  account_id: z.string().uuid().optional(),
  to_account_id: z.string().uuid().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  transaction_type: transactionTypeEnum.optional(),
  amount: z.number().positive().optional(),
  description: z.string().optional(),
  notes: z.string().nullable().optional(),
  receipt_url: z.string().nullable().optional(),
  transaction_date: z.coerce.date().optional(),
  tags: z.array(z.string()).optional()
});

export type UpdateTransactionInput = z.infer<typeof updateTransactionInputSchema>;

export const updateBudgetInputSchema = z.object({
  id: z.string().uuid(),
  name: z.string().optional(),
  amount: z.number().positive().optional(),
  period_start: z.coerce.date().optional(),
  period_end: z.coerce.date().optional(),
  is_active: z.boolean().optional()
});

export type UpdateBudgetInput = z.infer<typeof updateBudgetInputSchema>;

export const updateRecurringRuleInputSchema = z.object({
  id: z.string().uuid(),
  amount: z.number().positive().optional(),
  description: z.string().optional(),
  frequency: recurringFrequencyEnum.optional(),
  interval_count: z.number().int().positive().optional(),
  end_date: z.coerce.date().nullable().optional(),
  is_active: z.boolean().optional()
});

export type UpdateRecurringRuleInput = z.infer<typeof updateRecurringRuleInputSchema>;

export const updateSavingsGoalInputSchema = z.object({
  id: z.string().uuid(),
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  target_amount: z.number().positive().optional(),
  target_date: z.coerce.date().nullable().optional(),
  status: goalStatusEnum.optional()
});

export type UpdateSavingsGoalInput = z.infer<typeof updateSavingsGoalInputSchema>;

// Query schemas

export const getTransactionsInputSchema = z.object({
  account_id: z.string().uuid().optional(),
  category_id: z.string().uuid().optional(),
  transaction_type: transactionTypeEnum.optional(),
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional(),
  limit: z.number().int().positive().default(50),
  offset: z.number().int().nonnegative().default(0)
});

export type GetTransactionsInput = z.infer<typeof getTransactionsInputSchema>;

export const getFinancialSummaryInputSchema = z.object({
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  account_id: z.string().uuid().optional()
});

export type GetFinancialSummaryInput = z.infer<typeof getFinancialSummaryInputSchema>;

// Response schemas

export const financialSummarySchema = z.object({
  total_income: z.number(),
  total_expenses: z.number(),
  net_income: z.number(),
  account_balances: z.array(z.object({
    account_id: z.string().uuid(),
    account_name: z.string(),
    balance: z.number()
  })),
  expense_by_category: z.array(z.object({
    category_id: z.string().uuid(),
    category_name: z.string(),
    amount: z.number(),
    percentage: z.number()
  })),
  budget_status: z.array(z.object({
    budget_id: z.string().uuid(),
    budget_name: z.string(),
    allocated: z.number(),
    spent: z.number(),
    remaining: z.number(),
    percentage_used: z.number()
  }))
});

export type FinancialSummary = z.infer<typeof financialSummarySchema>;

export const aiInsightSchema = z.object({
  spending_insights: z.array(z.string()),
  budget_recommendations: z.array(z.string()),
  savings_suggestions: z.array(z.string()),
  financial_health_score: z.number().min(0).max(100),
  generated_at: z.coerce.date()
});

export type AiInsight = z.infer<typeof aiInsightSchema>;