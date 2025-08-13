import { 
  pgTable, 
  uuid, 
  text, 
  timestamp, 
  numeric, 
  boolean, 
  pgEnum, 
  integer,
  jsonb 
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const transactionTypeEnum = pgEnum('transaction_type', ['income', 'expense', 'transfer']);
export const accountTypeEnum = pgEnum('account_type', ['checking', 'savings', 'credit', 'cash', 'investment']);
export const categoryTypeEnum = pgEnum('category_type', ['income', 'expense']);
export const recurringFrequencyEnum = pgEnum('recurring_frequency', ['daily', 'weekly', 'monthly', 'quarterly', 'yearly']);
export const goalStatusEnum = pgEnum('goal_status', ['active', 'completed', 'paused']);

// Profiles table
export const profilesTable = pgTable('profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull().unique(), // Supabase auth user id
  display_name: text('display_name').notNull(),
  email: text('email').notNull(),
  currency: text('currency').notNull().default('IDR'),
  locale: text('locale').notNull().default('id-ID'),
  timezone: text('timezone').notNull().default('Asia/Jakarta'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  deleted_at: timestamp('deleted_at')
});

// Accounts table
export const accountsTable = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull(),
  name: text('name').notNull(),
  account_type: accountTypeEnum('account_type').notNull(),
  balance: numeric('balance', { precision: 15, scale: 2 }).notNull().default('0'),
  initial_balance: numeric('initial_balance', { precision: 15, scale: 2 }).notNull().default('0'),
  currency: text('currency').notNull().default('IDR'),
  color: text('color'),
  icon: text('icon'),
  is_default: boolean('is_default').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  deleted_at: timestamp('deleted_at')
});

// Categories table
export const categoriesTable = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull(),
  name: text('name').notNull(),
  category_type: categoryTypeEnum('category_type').notNull(),
  parent_id: uuid('parent_id'),
  color: text('color'),
  icon: text('icon'),
  is_system: boolean('is_system').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  deleted_at: timestamp('deleted_at')
});

// Transactions table
export const transactionsTable = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull(),
  account_id: uuid('account_id').notNull(),
  to_account_id: uuid('to_account_id'), // For transfers
  category_id: uuid('category_id'),
  transaction_type: transactionTypeEnum('transaction_type').notNull(),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  description: text('description').notNull(),
  notes: text('notes'),
  receipt_url: text('receipt_url'),
  transaction_date: timestamp('transaction_date').notNull(),
  recurring_rule_id: uuid('recurring_rule_id'),
  tags: jsonb('tags').default([]),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  deleted_at: timestamp('deleted_at')
});

// Budgets table
export const budgetsTable = pgTable('budgets', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull(),
  category_id: uuid('category_id').notNull(),
  name: text('name').notNull(),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  spent: numeric('spent', { precision: 15, scale: 2 }).notNull().default('0'),
  period_start: timestamp('period_start').notNull(),
  period_end: timestamp('period_end').notNull(),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  deleted_at: timestamp('deleted_at')
});

// Recurring rules table
export const recurringRulesTable = pgTable('recurring_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull(),
  account_id: uuid('account_id').notNull(),
  to_account_id: uuid('to_account_id'),
  category_id: uuid('category_id'),
  transaction_type: transactionTypeEnum('transaction_type').notNull(),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  description: text('description').notNull(),
  frequency: recurringFrequencyEnum('frequency').notNull(),
  interval_count: integer('interval_count').notNull().default(1),
  start_date: timestamp('start_date').notNull(),
  end_date: timestamp('end_date'),
  next_occurrence: timestamp('next_occurrence').notNull(),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  deleted_at: timestamp('deleted_at')
});

// Savings goals table
export const savingsGoalsTable = pgTable('savings_goals', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull(),
  account_id: uuid('account_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  target_amount: numeric('target_amount', { precision: 15, scale: 2 }).notNull(),
  current_amount: numeric('current_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  target_date: timestamp('target_date'),
  status: goalStatusEnum('status').notNull().default('active'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  deleted_at: timestamp('deleted_at')
});

// Audit log table
export const auditLogTable = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull(),
  entity_type: text('entity_type').notNull(),
  entity_id: uuid('entity_id').notNull(),
  action: text('action').notNull(),
  old_values: jsonb('old_values'),
  new_values: jsonb('new_values'),
  ip_address: text('ip_address'),
  user_agent: text('user_agent'),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Relations
export const profilesRelations = relations(profilesTable, ({ many }) => ({
  accounts: many(accountsTable),
  categories: many(categoriesTable),
  transactions: many(transactionsTable),
  budgets: many(budgetsTable),
  recurringRules: many(recurringRulesTable),
  savingsGoals: many(savingsGoalsTable),
  auditLogs: many(auditLogTable)
}));

export const accountsRelations = relations(accountsTable, ({ one, many }) => ({
  profile: one(profilesTable, {
    fields: [accountsTable.user_id],
    references: [profilesTable.user_id]
  }),
  transactions: many(transactionsTable, { relationName: 'account_transactions' }),
  transferTransactions: many(transactionsTable, { relationName: 'to_account_transactions' }),
  recurringRules: many(recurringRulesTable, { relationName: 'account_recurring_rules' }),
  transferRecurringRules: many(recurringRulesTable, { relationName: 'to_account_recurring_rules' }),
  savingsGoals: many(savingsGoalsTable)
}));

export const categoriesRelations = relations(categoriesTable, ({ one, many }) => ({
  profile: one(profilesTable, {
    fields: [categoriesTable.user_id],
    references: [profilesTable.user_id]
  }),
  parent: one(categoriesTable, {
    fields: [categoriesTable.parent_id],
    references: [categoriesTable.id],
    relationName: 'category_parent'
  }),
  children: many(categoriesTable, { relationName: 'category_parent' }),
  transactions: many(transactionsTable),
  budgets: many(budgetsTable),
  recurringRules: many(recurringRulesTable)
}));

export const transactionsRelations = relations(transactionsTable, ({ one }) => ({
  profile: one(profilesTable, {
    fields: [transactionsTable.user_id],
    references: [profilesTable.user_id]
  }),
  account: one(accountsTable, {
    fields: [transactionsTable.account_id],
    references: [accountsTable.id],
    relationName: 'account_transactions'
  }),
  toAccount: one(accountsTable, {
    fields: [transactionsTable.to_account_id],
    references: [accountsTable.id],
    relationName: 'to_account_transactions'
  }),
  category: one(categoriesTable, {
    fields: [transactionsTable.category_id],
    references: [categoriesTable.id]
  }),
  recurringRule: one(recurringRulesTable, {
    fields: [transactionsTable.recurring_rule_id],
    references: [recurringRulesTable.id]
  })
}));

export const budgetsRelations = relations(budgetsTable, ({ one }) => ({
  profile: one(profilesTable, {
    fields: [budgetsTable.user_id],
    references: [profilesTable.user_id]
  }),
  category: one(categoriesTable, {
    fields: [budgetsTable.category_id],
    references: [categoriesTable.id]
  })
}));

export const recurringRulesRelations = relations(recurringRulesTable, ({ one, many }) => ({
  profile: one(profilesTable, {
    fields: [recurringRulesTable.user_id],
    references: [profilesTable.user_id]
  }),
  account: one(accountsTable, {
    fields: [recurringRulesTable.account_id],
    references: [accountsTable.id],
    relationName: 'account_recurring_rules'
  }),
  toAccount: one(accountsTable, {
    fields: [recurringRulesTable.to_account_id],
    references: [accountsTable.id],
    relationName: 'to_account_recurring_rules'
  }),
  category: one(categoriesTable, {
    fields: [recurringRulesTable.category_id],
    references: [categoriesTable.id]
  }),
  transactions: many(transactionsTable)
}));

export const savingsGoalsRelations = relations(savingsGoalsTable, ({ one }) => ({
  profile: one(profilesTable, {
    fields: [savingsGoalsTable.user_id],
    references: [profilesTable.user_id]
  }),
  account: one(accountsTable, {
    fields: [savingsGoalsTable.account_id],
    references: [accountsTable.id]
  })
}));

export const auditLogRelations = relations(auditLogTable, ({ one }) => ({
  profile: one(profilesTable, {
    fields: [auditLogTable.user_id],
    references: [profilesTable.user_id]
  })
}));

// Export all tables for drizzle queries and relations
export const tables = {
  profiles: profilesTable,
  accounts: accountsTable,
  categories: categoriesTable,
  transactions: transactionsTable,
  budgets: budgetsTable,
  recurringRules: recurringRulesTable,
  savingsGoals: savingsGoalsTable,
  auditLog: auditLogTable
};

// TypeScript types for table schemas
export type Profile = typeof profilesTable.$inferSelect;
export type NewProfile = typeof profilesTable.$inferInsert;

export type Account = typeof accountsTable.$inferSelect;
export type NewAccount = typeof accountsTable.$inferInsert;

export type Category = typeof categoriesTable.$inferSelect;
export type NewCategory = typeof categoriesTable.$inferInsert;

export type Transaction = typeof transactionsTable.$inferSelect;
export type NewTransaction = typeof transactionsTable.$inferInsert;

export type Budget = typeof budgetsTable.$inferSelect;
export type NewBudget = typeof budgetsTable.$inferInsert;

export type RecurringRule = typeof recurringRulesTable.$inferSelect;
export type NewRecurringRule = typeof recurringRulesTable.$inferInsert;

export type SavingsGoal = typeof savingsGoalsTable.$inferSelect;
export type NewSavingsGoal = typeof savingsGoalsTable.$inferInsert;

export type AuditLog = typeof auditLogTable.$inferSelect;
export type NewAuditLog = typeof auditLogTable.$inferInsert;