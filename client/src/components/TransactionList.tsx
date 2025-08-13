import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  Calendar,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Plus,
  MoreHorizontal
} from 'lucide-react';
import { trpc } from '@/utils/trpc';
// Type definitions
type TransactionType = 'income' | 'expense' | 'transfer';
type AccountType = 'checking' | 'savings' | 'credit' | 'cash' | 'investment';
type CategoryType = 'income' | 'expense';

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

interface Category {
  id: string;
  user_id: string;
  name: string;
  category_type: CategoryType;
  parent_id: string | null;
  color: string | null;
  icon: string | null;
  is_system: boolean;
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

interface GetTransactionsInput {
  account_id?: string;
  category_id?: string;
  transaction_type?: TransactionType;
  start_date?: Date;
  end_date?: Date;
  limit?: number;
  offset?: number;
}

interface UpdateTransactionInput {
  id: string;
  account_id?: string;
  to_account_id?: string | null;
  category_id?: string | null;
  transaction_type?: TransactionType;
  amount?: number;
  description?: string;
  notes?: string | null;
  receipt_url?: string | null;
  transaction_date?: Date;
  tags?: string[];
}

interface TransactionListProps {
  onUpdate?: () => void;
  compactMode?: boolean;
}

export function TransactionList({ onUpdate, compactMode = false }: TransactionListProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  // Filters
  const [filters, setFilters] = useState<GetTransactionsInput>({
    limit: 50,
    offset: 0
  });
  const [searchTerm, setSearchTerm] = useState('');

  // Load data
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [transactionData, accountData, categoryData] = await Promise.all([
        trpc.getTransactions.query(filters),
        trpc.getAccounts.query(),
        trpc.getCategories.query()
      ]);
      // Handle both array response and paginated response
      const transactions = Array.isArray(transactionData) ? transactionData : transactionData.transactions || [];
      setTransactions(transactions);
      setAccounts(accountData);
      setCategories(categoryData);
    } catch (error) {
      console.error('Failed to load transaction data:', error);
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

  // Get account name
  const getAccountName = (accountId: string) => {
    const account = accounts.find((acc: Account) => acc.id === accountId);
    return account?.name || 'Unknown Account';
  };

  // Get category name
  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return 'No Category';
    const category = categories.find((cat: Category) => cat.id === categoryId);
    return category?.name || 'Unknown Category';
  };

  // Filter transactions by search term
  const filteredTransactions = transactions.filter((transaction: Transaction) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      transaction.description.toLowerCase().includes(searchLower) ||
      getAccountName(transaction.account_id).toLowerCase().includes(searchLower) ||
      getCategoryName(transaction.category_id).toLowerCase().includes(searchLower)
    );
  });

  // Handle edit transaction
  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setIsEditDialogOpen(true);
  };

  // Handle update transaction
  const handleUpdateTransaction = async (updatedData: Partial<UpdateTransactionInput>) => {
    if (!editingTransaction) return;

    try {
      await trpc.updateTransaction.mutate({
        id: editingTransaction.id,
        ...updatedData
      });
      await loadData();
      onUpdate?.();
      setIsEditDialogOpen(false);
      setEditingTransaction(null);
    } catch (error) {
      console.error('Failed to update transaction:', error);
    }
  };

  // Handle delete transaction
  const handleDeleteTransaction = async (transactionId: string) => {
    try {
      await trpc.deleteTransaction.mutate({ transactionId });
      await loadData();
      onUpdate?.();
    } catch (error) {
      console.error('Failed to delete transaction:', error);
    }
  };

  // Quick filter functions
  const setQuickFilter = (type: 'all' | 'income' | 'expense' | 'transfer') => {
    setFilters((prev: GetTransactionsInput) => ({
      ...prev,
      transaction_type: type === 'all' ? undefined : type,
      offset: 0
    }));
  };

  const setDateFilter = (days: number) => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    setFilters(prev => ({
      ...prev,
      start_date: startDate,
      end_date: endDate,
      offset: 0
    }));
  };

  if (compactMode) {
    // Compact mode for dashboard
    return (
      <div className="space-y-4">
        {filteredTransactions.slice(0, 5).map((transaction: Transaction) => (
          <div key={transaction.id} className="flex justify-between items-center p-3 rounded-lg bg-gray-50 hover:bg-gray-100">
            <div className="flex-1">
              <p className="font-medium text-sm">{transaction.description}</p>
              <div className="flex items-center space-x-2 text-xs text-gray-500">
                <span>{getAccountName(transaction.account_id)}</span>
                <span>•</span>
                <span>{getCategoryName(transaction.category_id)}</span>
                <span>•</span>
                <span>{transaction.transaction_date.toLocaleDateString('id-ID')}</span>
              </div>
            </div>
            <div className="text-right">
              <Badge 
                variant={transaction.transaction_type === 'income' ? 'default' : 'destructive'}
                className={transaction.transaction_type === 'income' ? 'bg-green-100 text-green-800' : ''}
              >
                {transaction.transaction_type === 'income' ? '+' : '-'}
                {formatCurrency(Math.abs(transaction.amount))}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Full transaction list view
  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="w-5 h-5 mr-2 text-blue-600" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={!filters.transaction_type ? 'default' : 'outline'}
              size="sm"
              onClick={() => setQuickFilter('all')}
            >
              All
            </Button>
            <Button
              variant={filters.transaction_type === 'income' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setQuickFilter('income')}
            >
              <TrendingUp className="w-3 h-3 mr-1" />
              Income
            </Button>
            <Button
              variant={filters.transaction_type === 'expense' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setQuickFilter('expense')}
            >
              <TrendingDown className="w-3 h-3 mr-1" />
              Expenses
            </Button>
            <Button
              variant={filters.transaction_type === 'transfer' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setQuickFilter('transfer')}
            >
              🔄 Transfers
            </Button>
          </div>

          {/* Date Filters */}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setDateFilter(7)}>
              Last 7 days
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDateFilter(30)}>
              Last 30 days
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDateFilter(90)}>
              Last 3 months
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setFilters(prev => ({ ...prev, start_date: undefined, end_date: undefined }))}
            >
              All time
            </Button>
          </div>

          {/* Custom Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={filters.start_date?.toISOString().split('T')[0] || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFilters(prev => ({
                    ...prev,
                    start_date: e.target.value ? new Date(e.target.value) : undefined,
                    offset: 0
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">End Date</Label>
              <Input
                id="end_date"
                type="date"
                value={filters.end_date?.toISOString().split('T')[0] || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFilters(prev => ({
                    ...prev,
                    end_date: e.target.value ? new Date(e.target.value) : undefined,
                    offset: 0
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Account Filter</Label>
              <Select
                value={filters.account_id || 'all'}
                onValueChange={(value: string) =>
                  setFilters(prev => ({
                    ...prev,
                    account_id: value === 'all' ? undefined : value,
                    offset: 0
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

      {/* Transaction List */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center">
              📊 Transactions ({filteredTransactions.length})
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading transactions...</p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-12">
              <TrendingUp className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 mb-2">No transactions found</p>
              <p className="text-sm text-gray-500">
                {searchTerm ? 'Try adjusting your search or filters' : 'Add your first transaction to get started'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTransactions.map((transaction: Transaction) => (
                <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      transaction.transaction_type === 'income' ? 'bg-green-100' :
                      transaction.transaction_type === 'expense' ? 'bg-red-100' : 'bg-blue-100'
                    }`}>
                      {transaction.transaction_type === 'income' ? (
                        <TrendingUp className="w-4 h-4 text-green-600" />
                      ) : transaction.transaction_type === 'expense' ? (
                        <TrendingDown className="w-4 h-4 text-red-600" />
                      ) : (
                        <ArrowUpDown className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <h4 className="font-medium">{transaction.description}</h4>
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <span>{getAccountName(transaction.account_id)}</span>
                        <span>•</span>
                        <span>{getCategoryName(transaction.category_id)}</span>
                        <span>•</span>
                        <div className="flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          {transaction.transaction_date.toLocaleDateString('id-ID')}
                        </div>
                      </div>
                      {transaction.notes && (
                        <p className="text-xs text-gray-500 mt-1">{transaction.notes}</p>
                      )}
                      {transaction.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {transaction.tags.map((tag: string, index: number) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className={`font-semibold ${
                        transaction.transaction_type === 'income' ? 'text-green-600' : 'text-gray-900'
                      }`}>
                        {transaction.transaction_type === 'income' ? '+' : ''}
                        {formatCurrency(transaction.amount)}
                      </p>
                      <p className="text-xs text-gray-500 capitalize">
                        {transaction.transaction_type}
                      </p>
                    </div>

                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditTransaction(transaction)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{transaction.description}"? 
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteTransaction(transaction.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Transaction Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
          </DialogHeader>
          {editingTransaction && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={editingTransaction.description}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setEditingTransaction(prev => prev ? { ...prev, description: e.target.value } : null)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  value={editingTransaction.amount}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setEditingTransaction(prev => prev ? { ...prev, amount: parseFloat(e.target.value) || 0 } : null)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={editingTransaction.transaction_date.toISOString().split('T')[0]}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setEditingTransaction(prev => prev ? { ...prev, transaction_date: new Date(e.target.value) } : null)
                  }
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleUpdateTransaction({
                    description: editingTransaction.description,
                    amount: editingTransaction.amount,
                    transaction_date: editingTransaction.transaction_date
                  })}
                >
                  Update
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}