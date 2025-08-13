import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import all schemas
import {
  createProfileInputSchema,
  updateProfileInputSchema,
  createAccountInputSchema,
  updateAccountInputSchema,
  createCategoryInputSchema,
  updateCategoryInputSchema,
  createTransactionInputSchema,
  updateTransactionInputSchema,
  getTransactionsInputSchema,
  createBudgetInputSchema,
  updateBudgetInputSchema,
  createRecurringRuleInputSchema,
  updateRecurringRuleInputSchema,
  createSavingsGoalInputSchema,
  updateSavingsGoalInputSchema,
  getFinancialSummaryInputSchema
} from './schema';

// Import all handlers
import { createProfile } from './handlers/create_profile';
import { getProfile } from './handlers/get_profile';
import { updateProfile } from './handlers/update_profile';
import { createAccount } from './handlers/create_account';
import { getAccounts } from './handlers/get_accounts';
import { updateAccount } from './handlers/update_account';
import { deleteAccount } from './handlers/delete_account';
import { createCategory } from './handlers/create_category';
import { getCategories } from './handlers/get_categories';
import { createTransaction } from './handlers/create_transaction';
import { getTransactions } from './handlers/get_transactions';
import { updateTransaction } from './handlers/update_transaction';
import { deleteTransaction } from './handlers/delete_transaction';
import { createBudget } from './handlers/create_budget';
import { getBudgets } from './handlers/get_budgets';
import { updateBudget } from './handlers/update_budget';
import { createRecurringRule } from './handlers/create_recurring_rule';
import { getRecurringRules } from './handlers/get_recurring_rules';
import { updateRecurringRule } from './handlers/update_recurring_rule';
import { createSavingsGoal } from './handlers/create_savings_goal';
import { getSavingsGoals } from './handlers/get_savings_goals';
import { updateSavingsGoal } from './handlers/update_savings_goal';
import { getFinancialSummary } from './handlers/get_financial_summary';
import { getAiInsights } from './handlers/get_ai_insights';
import { applyRecurringTransactions } from './handlers/apply_recurring_transactions';
import { importTransactions } from './handlers/import_transactions';
import { exportTransactions } from './handlers/export_transactions';
import { createDemoData } from './handlers/create_demo_data';
import { getDashboardData } from './handlers/get_dashboard_data';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

// Mock user authentication - in production this would be replaced with Supabase JWT verification
const authenticatedProcedure = publicProcedure.use(async ({ next }) => {
  // This is a placeholder! In production, you would:
  // 1. Extract JWT token from Authorization header
  // 2. Verify token with Supabase
  // 3. Extract user_id from token payload
  // 4. Pass user context to handlers
  
  const mockUserId = 'mock-user-id-123'; // Placeholder user ID
  return next({
    ctx: { userId: mockUserId }
  });
});

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Profile management
  createProfile: authenticatedProcedure
    .input(createProfileInputSchema)
    .mutation(({ input, ctx }) => createProfile(input, ctx.userId)),
  
  getProfile: authenticatedProcedure
    .query(({ ctx }) => getProfile(ctx.userId)),
  
  updateProfile: authenticatedProcedure
    .input(updateProfileInputSchema)
    .mutation(({ input, ctx }) => updateProfile(input, ctx.userId)),

  // Account management
  createAccount: authenticatedProcedure
    .input(createAccountInputSchema)
    .mutation(({ input, ctx }) => createAccount(input, ctx.userId)),
  
  getAccounts: authenticatedProcedure
    .query(({ ctx }) => getAccounts(ctx.userId)),
  
  updateAccount: authenticatedProcedure
    .input(updateAccountInputSchema)
    .mutation(({ input, ctx }) => updateAccount(input, ctx.userId)),
  
  deleteAccount: authenticatedProcedure
    .input(z.object({ accountId: z.string().uuid() }))
    .mutation(({ input, ctx }) => deleteAccount(input.accountId, ctx.userId)),

  // Category management
  createCategory: authenticatedProcedure
    .input(createCategoryInputSchema)
    .mutation(({ input, ctx }) => createCategory(input, ctx.userId)),
  
  getCategories: authenticatedProcedure
    .query(({ ctx }) => getCategories(ctx.userId)),

  // Transaction management
  createTransaction: authenticatedProcedure
    .input(createTransactionInputSchema)
    .mutation(({ input, ctx }) => createTransaction(input, ctx.userId)),
  
  getTransactions: authenticatedProcedure
    .input(getTransactionsInputSchema)
    .query(({ input, ctx }) => getTransactions(input, ctx.userId)),
  
  updateTransaction: authenticatedProcedure
    .input(updateTransactionInputSchema)
    .mutation(({ input, ctx }) => updateTransaction(input, ctx.userId)),
  
  deleteTransaction: authenticatedProcedure
    .input(z.object({ transactionId: z.string().uuid() }))
    .mutation(({ input, ctx }) => deleteTransaction(input.transactionId, ctx.userId)),

  // Budget management
  createBudget: authenticatedProcedure
    .input(createBudgetInputSchema)
    .mutation(({ input, ctx }) => createBudget(input, ctx.userId)),
  
  getBudgets: authenticatedProcedure
    .query(({ ctx }) => getBudgets(ctx.userId)),
  
  updateBudget: authenticatedProcedure
    .input(updateBudgetInputSchema)
    .mutation(({ input, ctx }) => updateBudget(input, ctx.userId)),

  // Recurring transaction management
  createRecurringRule: authenticatedProcedure
    .input(createRecurringRuleInputSchema)
    .mutation(({ input, ctx }) => createRecurringRule(input, ctx.userId)),
  
  getRecurringRules: authenticatedProcedure
    .query(({ ctx }) => getRecurringRules(ctx.userId)),
  
  updateRecurringRule: authenticatedProcedure
    .input(updateRecurringRuleInputSchema)
    .mutation(({ input, ctx }) => updateRecurringRule(input, ctx.userId)),

  // Savings goals management
  createSavingsGoal: authenticatedProcedure
    .input(createSavingsGoalInputSchema)
    .mutation(({ input, ctx }) => createSavingsGoal(input, ctx.userId)),
  
  getSavingsGoals: authenticatedProcedure
    .query(({ ctx }) => getSavingsGoals(ctx.userId)),
  
  updateSavingsGoal: authenticatedProcedure
    .input(updateSavingsGoalInputSchema)
    .mutation(({ input, ctx }) => updateSavingsGoal(input, ctx.userId)),

  // Financial reporting and insights
  getFinancialSummary: authenticatedProcedure
    .input(getFinancialSummaryInputSchema)
    .query(({ input, ctx }) => getFinancialSummary(input, ctx.userId)),
  
  getAiInsights: authenticatedProcedure
    .query(({ ctx }) => getAiInsights(ctx.userId)),
  
  getDashboardData: authenticatedProcedure
    .query(({ ctx }) => getDashboardData(ctx.userId)),

  // Data management
  importTransactions: authenticatedProcedure
    .input(z.object({
      data: z.array(z.object({
        date: z.string(),
        description: z.string(),
        amount: z.number(),
        category: z.string().optional(),
        account: z.string().optional(),
        type: z.enum(['income', 'expense', 'transfer'])
      })),
      defaultAccountId: z.string().uuid().optional()
    }))
    .mutation(({ input, ctx }) => importTransactions(input.data, ctx.userId, input.defaultAccountId)),
  
  exportTransactions: authenticatedProcedure
    .input(z.object({
      format: z.enum(['csv', 'json', 'excel']),
      startDate: z.coerce.date().optional(),
      endDate: z.coerce.date().optional(),
      accountIds: z.array(z.string().uuid()).optional(),
      categoryIds: z.array(z.string().uuid()).optional(),
      includeDeleted: z.boolean().default(false)
    }))
    .query(({ input, ctx }) => exportTransactions(ctx.userId, input)),

  // Utility and system operations
  applyRecurringTransactions: authenticatedProcedure
    .mutation(({ ctx }) => applyRecurringTransactions(ctx.userId)),
  
  createDemoData: authenticatedProcedure
    .mutation(({ ctx }) => createDemoData(ctx.userId)),

  // Admin/system operations (for Edge Functions)
  systemApplyRecurringTransactions: publicProcedure
    .input(z.object({ 
      authToken: z.string() // For Edge Function authentication
    }))
    .mutation(({ input }) => {
      // In production, validate authToken here
      return applyRecurringTransactions();
    })
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors({
        origin: process.env['CLIENT_URL'] || 'http://localhost:3000',
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
      })(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  
  server.listen(port);
  console.log(`Personal Finance TRPC server listening at port: ${port}`);
  console.log(`Environment: ${process.env['NODE_ENV'] || 'development'}`);
}

start().catch(console.error);