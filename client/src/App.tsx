import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/utils/trpc';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  PlusCircle, 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Target,
  BarChart3,
  Settings,
  Import,
  Download,
  Brain,
  Sparkles,
  HelpCircle
} from 'lucide-react';

// Type definitions (should match server schema)
type TransactionType = 'income' | 'expense' | 'transfer';
type AccountType = 'checking' | 'savings' | 'credit' | 'cash' | 'investment';
type GoalStatus = 'active' | 'completed' | 'paused';

interface Account {
  id: string;
  user_id: string;
  name: string;
  account_type: AccountType;
  balance: number;
  initial_balance: number;
  currency: string;
  color: string | null;
  icon: string | null;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  transaction_type: TransactionType;
  amount: number;
  description: string;
  notes: string | null;
  receipt_url: string | null;
  transaction_date: Date;
  recurring_rule_id: string | null;
  tags: string[];
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  name: string;
  amount: number;
  spent: number;
  period_start: Date;
  period_end: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

interface SavingsGoal {
  id: string;
  user_id: string;
  account_id: string;
  name: string;
  description: string | null;
  target_amount: number;
  current_amount: number;
  target_date: Date | null;
  status: GoalStatus;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

// Import custom components
import { TransactionForm } from '@/components/TransactionForm';
import { AccountManager } from '@/components/AccountManager';
import { BudgetManager } from '@/components/BudgetManager';
import { SavingsGoalManager } from '@/components/SavingsGoalManager';
import { FinancialReports } from '@/components/FinancialReports';
import { AiInsights } from '@/components/AiInsights';
import { DataImportExport } from '@/components/DataImportExport';
import { PWAInstallPrompt, IOSInstallPrompt } from '@/components/PWAInstallPrompt';
import { NotificationCenter } from '@/components/NotificationCenter';
import { TransactionList } from '@/components/TransactionList';
import { HelpCenter } from '@/components/HelpCenter';

interface DashboardData {
  accounts: Account[];
  recentTransactions: Transaction[];
  monthlyBudgets: Budget[];
  savingsGoals: SavingsGoal[];
  monthlyIncome: number;
  monthlyExpenses: number;
  netWorth: number;
}

function App() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await trpc.getDashboardData.query();
      setDashboardData(data);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Format currency in Indonesian Rupiah
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Handle demo data creation
  const handleCreateDemoData = async () => {
    try {
      await trpc.createDemoData.mutate();
      await loadDashboardData();
    } catch (error) {
      console.error('Failed to create demo data:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading your financial data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <div className="text-center flex-1">
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                💰 MoneyWise
              </h1>
              <p className="text-gray-600">
                Your Personal Finance Management Assistant
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <NotificationCenter />
            </div>
          </div>
        </div>

        {/* Demo Data Alert */}
        {(!dashboardData || dashboardData.accounts.length === 0) && (
          <Alert className="mb-6 border-yellow-200 bg-yellow-50">
            <Sparkles className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              Start exploring with demo data to see MoneyWise in action!{' '}
              <Button 
                variant="link" 
                className="p-0 h-auto text-yellow-700 underline"
                onClick={handleCreateDemoData}
              >
                Create Demo Data
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Main Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-8 lg:w-auto lg:flex lg:justify-start">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="transactions" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">Transactions</span>
            </TabsTrigger>
            <TabsTrigger value="accounts" className="flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              <span className="hidden sm:inline">Accounts</span>
            </TabsTrigger>
            <TabsTrigger value="budgets" className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              <span className="hidden sm:inline">Budgets</span>
            </TabsTrigger>
            <TabsTrigger value="goals" className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              <span className="hidden sm:inline">Goals</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Reports</span>
            </TabsTrigger>
            <TabsTrigger value="ai-insights" className="flex items-center gap-2">
              <Brain className="w-4 h-4" />
              <span className="hidden sm:inline">AI Insights</span>
            </TabsTrigger>
            <TabsTrigger value="help" className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Help</span>
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {dashboardData && (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium opacity-90">
                        💰 Net Worth
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatCurrency(dashboardData.netWorth)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium opacity-90 flex items-center">
                        <TrendingUp className="w-4 h-4 mr-1" />
                        Monthly Income
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatCurrency(dashboardData.monthlyIncome)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium opacity-90 flex items-center">
                        <TrendingDown className="w-4 h-4 mr-1" />
                        Monthly Expenses
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatCurrency(dashboardData.monthlyExpenses)}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Quick Actions */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <PlusCircle className="w-5 h-5 mr-2 text-blue-600" />
                        Quick Actions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <TransactionForm onSuccess={loadDashboardData} />
                    </CardContent>
                  </Card>

                  {/* Account Balances */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Wallet className="w-5 h-5 mr-2 text-green-600" />
                        Account Balances
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {dashboardData.accounts.length === 0 ? (
                        <p className="text-gray-500 text-sm">
                          No accounts yet. Create your first account to get started!
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {dashboardData.accounts.map((account: Account) => (
                            <div key={account.id} className="flex justify-between items-center">
                              <div className="flex items-center">
                                <div 
                                  className="w-3 h-3 rounded-full mr-3"
                                  style={{ backgroundColor: account.color || '#6b7280' }}
                                />
                                <div>
                                  <p className="font-medium">{account.name}</p>
                                  <p className="text-xs text-gray-500 capitalize">
                                    {account.account_type}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold">
                                  {formatCurrency(account.balance)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Recent Transactions */}
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <TrendingUp className="w-5 h-5 mr-2 text-purple-600" />
                        Recent Transactions
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {dashboardData.recentTransactions.length === 0 ? (
                        <p className="text-gray-500 text-sm">
                          No transactions yet. Add your first transaction above!
                        </p>
                      ) : (
                        <TransactionList onUpdate={loadDashboardData} compactMode />
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Budget Progress & Savings Goals */}
                {(dashboardData.monthlyBudgets.length > 0 || dashboardData.savingsGoals.length > 0) && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Budget Progress */}
                    {dashboardData.monthlyBudgets.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center">
                            <Target className="w-5 h-5 mr-2 text-orange-600" />
                            Budget Progress
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {dashboardData.monthlyBudgets.slice(0, 3).map((budget: Budget) => {
                              const progress = (budget.spent / budget.amount) * 100;
                              return (
                                <div key={budget.id} className="space-y-2">
                                  <div className="flex justify-between items-center">
                                    <span className="font-medium">{budget.name}</span>
                                    <span className="text-sm text-gray-600">
                                      {formatCurrency(budget.spent)} / {formatCurrency(budget.amount)}
                                    </span>
                                  </div>
                                  <Progress 
                                    value={progress} 
                                    className={`h-2 ${progress > 100 ? 'bg-red-100' : ''}`}
                                  />
                                  <p className="text-xs text-gray-500">
                                    {progress > 100 ? 'Over budget!' : `${Math.round(progress)}% used`}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Savings Goals */}
                    {dashboardData.savingsGoals.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center">
                            <Target className="w-5 h-5 mr-2 text-indigo-600" />
                            Savings Goals
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {dashboardData.savingsGoals.slice(0, 3).map((goal: SavingsGoal) => {
                              const progress = (goal.current_amount / goal.target_amount) * 100;
                              return (
                                <div key={goal.id} className="space-y-2">
                                  <div className="flex justify-between items-center">
                                    <span className="font-medium">{goal.name}</span>
                                    <span className="text-sm text-gray-600">
                                      {formatCurrency(goal.current_amount)} / {formatCurrency(goal.target_amount)}
                                    </span>
                                  </div>
                                  <Progress value={Math.min(progress, 100)} className="h-2" />
                                  <p className="text-xs text-gray-500">
                                    {Math.round(progress)}% achieved
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Other Tabs */}
          <TabsContent value="transactions">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>📊 Add New Transaction</CardTitle>
                </CardHeader>
                <CardContent>
                  <TransactionForm onSuccess={loadDashboardData} detailed />
                </CardContent>
              </Card>
              
              <TransactionList onUpdate={loadDashboardData} />
            </div>
          </TabsContent>

          <TabsContent value="accounts">
            <AccountManager onUpdate={loadDashboardData} />
          </TabsContent>

          <TabsContent value="budgets">
            <BudgetManager onUpdate={loadDashboardData} />
          </TabsContent>

          <TabsContent value="goals">
            <SavingsGoalManager onUpdate={loadDashboardData} />
          </TabsContent>

          <TabsContent value="reports">
            <FinancialReports />
          </TabsContent>

          <TabsContent value="ai-insights">
            <AiInsights />
          </TabsContent>

          <TabsContent value="help">
            <HelpCenter />
          </TabsContent>
        </Tabs>

        {/* Data Import/Export */}
        <div className="mt-8">
          <DataImportExport onUpdate={loadDashboardData} />
        </div>
      </div>

      {/* PWA Install Prompts */}
      <PWAInstallPrompt />
      <IOSInstallPrompt />
    </div>
  );
}

export default App;