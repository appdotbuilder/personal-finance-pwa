import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  PieChart, 
  Calendar,
  DollarSign,
  Activity,
  Target
} from 'lucide-react';
import { trpc } from '@/utils/trpc';
// Type definitions
type AccountType = 'checking' | 'savings' | 'credit' | 'cash' | 'investment';

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

interface GetFinancialSummaryInput {
  start_date: Date;
  end_date: Date;
  account_id?: string;
}

interface FinancialSummary {
  total_income: number;
  total_expenses: number;
  net_income: number;
  account_balances: Array<{
    account_id: string;
    account_name: string;
    balance: number;
  }>;
  expense_by_category: Array<{
    category_id: string;
    category_name: string;
    amount: number;
    percentage: number;
  }>;
  budget_status: Array<{
    budget_id: string;
    budget_name: string;
    allocated: number;
    spent: number;
    remaining: number;
    percentage_used: number;
  }>;
}

export function FinancialReports() {
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const [filters, setFilters] = useState<GetFinancialSummaryInput>({
    start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1), // First day of current month
    end_date: new Date(), // Today
    account_id: undefined
  });

  // Load data
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [summaryData, accountsData] = await Promise.all([
        trpc.getFinancialSummary.query(filters),
        trpc.getAccounts.query()
      ]);
      setFinancialSummary(summaryData);
      setAccounts(accountsData);
    } catch (error) {
      console.error('Failed to load financial data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Quick date filters
  const setQuickFilter = (type: string) => {
    const now = new Date();
    let start_date: Date;
    let end_date: Date = new Date();

    switch (type) {
      case 'this_week':
        start_date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
        break;
      case 'this_month':
        start_date = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'last_month':
        start_date = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end_date = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'this_quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        start_date = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case 'this_year':
        start_date = new Date(now.getFullYear(), 0, 1);
        break;
      case 'last_year':
        start_date = new Date(now.getFullYear() - 1, 0, 1);
        end_date = new Date(now.getFullYear() - 1, 11, 31);
        break;
      default:
        return;
    }

    setFilters((prev: GetFinancialSummaryInput) => ({
      ...prev,
      start_date,
      end_date
    }));
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading financial reports...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="w-5 h-5 mr-2 text-blue-600" />
            📈 Financial Reports
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filter Reports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Filters */}
          <div>
            <Label className="mb-2 block">Quick Filters</Label>
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setQuickFilter('this_week')}
              >
                This Week
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setQuickFilter('this_month')}
              >
                This Month
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setQuickFilter('last_month')}
              >
                Last Month
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setQuickFilter('this_quarter')}
              >
                This Quarter
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setQuickFilter('this_year')}
              >
                This Year
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setQuickFilter('last_year')}
              >
                Last Year
              </Button>
            </div>
          </div>

          {/* Custom Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={filters.start_date.toISOString().split('T')[0]}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFilters((prev: GetFinancialSummaryInput) => ({
                    ...prev,
                    start_date: new Date(e.target.value)
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">End Date</Label>
              <Input
                id="end_date"
                type="date"
                value={filters.end_date.toISOString().split('T')[0]}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFilters((prev: GetFinancialSummaryInput) => ({
                    ...prev,
                    end_date: new Date(e.target.value)
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Account Filter</Label>
              <Select
                value={filters.account_id || 'all'}
                onValueChange={(value: string) =>
                  setFilters((prev: GetFinancialSummaryInput) => ({
                    ...prev,
                    account_id: value === 'all' ? undefined : value
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Accounts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {accounts.map((account: Account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Financial Summary */}
      {financialSummary && (
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="accounts">Accounts</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="budgets">Budgets</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium opacity-90 flex items-center">
                    <TrendingUp className="w-4 h-4 mr-1" />
                    Total Income
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(financialSummary.total_income)}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium opacity-90 flex items-center">
                    <TrendingDown className="w-4 h-4 mr-1" />
                    Total Expenses
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(financialSummary.total_expenses)}
                  </div>
                </CardContent>
              </Card>

              <Card className={`bg-gradient-to-br ${
                financialSummary.net_income >= 0 
                  ? 'from-blue-500 to-blue-600' 
                  : 'from-orange-500 to-orange-600'
              } text-white`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium opacity-90 flex items-center">
                    <Activity className="w-4 h-4 mr-1" />
                    Net Income
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(financialSummary.net_income)}
                  </div>
                  <p className="text-xs opacity-75 mt-1">
                    {financialSummary.net_income >= 0 ? 'Surplus' : 'Deficit'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Summary Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Financial Health</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Savings Rate */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Savings Rate</span>
                      <span className="text-sm text-gray-600">
                        {financialSummary.total_income > 0 
                          ? Math.round((financialSummary.net_income / financialSummary.total_income) * 100)
                          : 0
                        }%
                      </span>
                    </div>
                    <Progress 
                      value={Math.max(0, (financialSummary.net_income / financialSummary.total_income) * 100)} 
                      className="h-2"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Recommended: 20% or higher
                    </p>
                  </div>

                  {/* Expense Ratio */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Expense Ratio</span>
                      <span className="text-sm text-gray-600">
                        {financialSummary.total_income > 0 
                          ? Math.round((financialSummary.total_expenses / financialSummary.total_income) * 100)
                          : 0
                        }%
                      </span>
                    </div>
                    <Progress 
                      value={(financialSummary.total_expenses / financialSummary.total_income) * 100} 
                      className="h-2"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Lower is better
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Accounts Tab */}
          <TabsContent value="accounts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <DollarSign className="w-5 h-5 mr-2" />
                  Account Balances
                </CardTitle>
              </CardHeader>
              <CardContent>
                {financialSummary.account_balances.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No account data available</p>
                ) : (
                  <div className="space-y-4">
                    {financialSummary.account_balances.map((account: {
                      account_id: string;
                      account_name: string;
                      balance: number;
                    }) => (
                      <div key={account.account_id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium">{account.account_name}</p>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold ${
                            account.balance >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {formatCurrency(account.balance)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <PieChart className="w-5 h-5 mr-2" />
                  Expense by Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                {financialSummary.expense_by_category.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No expense data available</p>
                ) : (
                  <div className="space-y-4">
                    {financialSummary.expense_by_category.map((category: {
                      category_id: string;
                      category_name: string;
                      amount: number;
                      percentage: number;
                    }) => (
                      <div key={category.category_id} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{category.category_name}</span>
                          <div className="text-right">
                            <span className="font-semibold">{formatCurrency(category.amount)}</span>
                            <Badge variant="secondary" className="ml-2">
                              {category.percentage.toFixed(1)}%
                            </Badge>
                          </div>
                        </div>
                        <Progress value={category.percentage} className="h-2" />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Budgets Tab */}
          <TabsContent value="budgets" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Target className="w-5 h-5 mr-2" />
                  Budget Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                {financialSummary.budget_status.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No budget data available</p>
                ) : (
                  <div className="space-y-4">
                    {financialSummary.budget_status.map((budget) => (
                      <div key={budget.budget_id} className="space-y-2 p-4 bg-gray-50 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{budget.budget_name}</span>
                          <Badge 
                            variant={budget.percentage_used >= 100 ? 'destructive' : 
                                     budget.percentage_used >= 80 ? 'default' : 'secondary'}
                            className={budget.percentage_used >= 80 && budget.percentage_used < 100 ? 'bg-yellow-100 text-yellow-800' : ''}
                          >
                            {budget.percentage_used.toFixed(1)}%
                          </Badge>
                        </div>
                        <div className="flex justify-between text-sm text-gray-600">
                          <span>{formatCurrency(budget.spent)} / {formatCurrency(budget.allocated)}</span>
                          <span className={budget.remaining >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {budget.remaining >= 0 ? 'Remaining: ' : 'Over by: '}
                            {formatCurrency(Math.abs(budget.remaining))}
                          </span>
                        </div>
                        <Progress 
                          value={Math.min(budget.percentage_used, 100)} 
                          className={`h-2 ${budget.percentage_used >= 100 ? 'bg-red-100' : ''}`}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Period Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            Period Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Report for {filters.start_date.toLocaleDateString('id-ID')} - {filters.end_date.toLocaleDateString('id-ID')}
            {filters.account_id && (
              <span className="ml-2">
                • Account: {accounts.find(acc => acc.id === filters.account_id)?.name || 'Unknown'}
              </span>
            )}
          </p>
          
          {financialSummary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-sm text-gray-600">Days</p>
                <p className="text-lg font-semibold">
                  {Math.ceil((filters.end_date.getTime() - filters.start_date.getTime()) / (1000 * 60 * 60 * 24)) + 1}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Avg Daily Income</p>
                <p className="text-lg font-semibold text-green-600">
                  {formatCurrency(
                    financialSummary.total_income / 
                    (Math.ceil((filters.end_date.getTime() - filters.start_date.getTime()) / (1000 * 60 * 60 * 24)) + 1)
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Avg Daily Expense</p>
                <p className="text-lg font-semibold text-red-600">
                  {formatCurrency(
                    financialSummary.total_expenses / 
                    (Math.ceil((filters.end_date.getTime() - filters.start_date.getTime()) / (1000 * 60 * 60 * 24)) + 1)
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Daily Net</p>
                <p className={`text-lg font-semibold ${
                  financialSummary.net_income >= 0 ? 'text-blue-600' : 'text-orange-600'
                }`}>
                  {formatCurrency(
                    financialSummary.net_income / 
                    (Math.ceil((filters.end_date.getTime() - filters.start_date.getTime()) / (1000 * 60 * 60 * 24)) + 1)
                  )}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}