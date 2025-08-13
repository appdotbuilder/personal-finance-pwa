import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { 
  Wallet, 
  PlusCircle, 
  Edit, 
  Trash2, 
  CreditCard, 
  PiggyBank, 
  Banknote,
  TrendingUp,
  Star
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

interface CreateAccountInput {
  name: string;
  account_type: AccountType;
  initial_balance: number;
  currency: string;
  color: string | null;
  icon: string | null;
  is_default: boolean;
}

interface UpdateAccountInput {
  id: string;
  name?: string;
  color?: string | null;
  icon?: string | null;
  is_default?: boolean;
}

interface AccountManagerProps {
  onUpdate?: () => void;
}

const accountTypeIcons = {
  checking: <Banknote className="w-4 h-4" />,
  savings: <PiggyBank className="w-4 h-4" />,
  credit: <CreditCard className="w-4 h-4" />,
  cash: <Wallet className="w-4 h-4" />,
  investment: <TrendingUp className="w-4 h-4" />
};

const accountTypeColors: Record<AccountType, string> = {
  checking: '#3b82f6',
  savings: '#10b981',
  credit: '#ef4444',
  cash: '#f59e0b',
  investment: '#8b5cf6'
};

export function AccountManager({ onUpdate }: AccountManagerProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  
  const [formData, setFormData] = useState<CreateAccountInput>({
    name: '',
    account_type: 'checking',
    initial_balance: 0,
    currency: 'IDR',
    color: null,
    icon: null,
    is_default: false
  });

  // Load accounts
  const loadAccounts = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await trpc.getAccounts.query();
      setAccounts(data);
    } catch (error) {
      console.error('Failed to load accounts:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      account_type: 'checking',
      initial_balance: 0,
      currency: 'IDR',
      color: null,
      icon: null,
      is_default: false
    });
    setEditingAccount(null);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    setIsLoading(true);
    try {
      if (editingAccount) {
        // Update existing account
        await trpc.updateAccount.mutate({
          id: editingAccount.id,
          name: formData.name,
          color: formData.color,
          icon: formData.icon,
          is_default: formData.is_default
        });
      } else {
        // Create new account
        await trpc.createAccount.mutate({
          ...formData,
          color: formData.color || accountTypeColors[formData.account_type]
        });
      }

      await loadAccounts();
      onUpdate?.();
      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Failed to save account:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle edit
  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      account_type: account.account_type,
      initial_balance: account.initial_balance,
      currency: account.currency,
      color: account.color,
      icon: account.icon,
      is_default: account.is_default
    });
    setIsDialogOpen(true);
  };

  // Handle delete
  const handleDelete = async (accountId: string) => {
    try {
      setIsLoading(true);
      await trpc.deleteAccount.mutate({ accountId });
      await loadAccounts();
      onUpdate?.();
    } catch (error) {
      console.error('Failed to delete account:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center">
              <Wallet className="w-5 h-5 mr-2 text-blue-600" />
              💳 Account Management
            </CardTitle>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Add Account
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>
                    {editingAccount ? 'Edit Account' : 'Create New Account'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Account Name */}
                  <div className="space-y-2">
                    <Label htmlFor="name">Account Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Main Checking, Savings Goal"
                      value={formData.name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData((prev: CreateAccountInput) => ({ 
                          ...prev, 
                          name: e.target.value 
                        }))
                      }
                      required
                    />
                  </div>

                  {/* Account Type (only for new accounts) */}
                  {!editingAccount && (
                    <div className="space-y-2">
                      <Label>Account Type</Label>
                      <Select
                        value={formData.account_type}
                        onValueChange={(value: AccountType) =>
                          setFormData((prev: CreateAccountInput) => ({ 
                            ...prev, 
                            account_type: value,
                            color: accountTypeColors[value]
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="checking">
                            <div className="flex items-center">
                              {accountTypeIcons.checking}
                              <span className="ml-2">Checking Account</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="savings">
                            <div className="flex items-center">
                              {accountTypeIcons.savings}
                              <span className="ml-2">Savings Account</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="credit">
                            <div className="flex items-center">
                              {accountTypeIcons.credit}
                              <span className="ml-2">Credit Card</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="cash">
                            <div className="flex items-center">
                              {accountTypeIcons.cash}
                              <span className="ml-2">Cash</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="investment">
                            <div className="flex items-center">
                              {accountTypeIcons.investment}
                              <span className="ml-2">Investment</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Initial Balance (only for new accounts) */}
                  {!editingAccount && (
                    <div className="space-y-2">
                      <Label htmlFor="balance">Initial Balance (IDR)</Label>
                      <Input
                        id="balance"
                        type="number"
                        placeholder="0"
                        value={formData.initial_balance || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setFormData((prev: CreateAccountInput) => ({ 
                            ...prev, 
                            initial_balance: parseFloat(e.target.value) || 0 
                          }))
                        }
                        step="0.01"
                      />
                    </div>
                  )}

                  {/* Color Picker */}
                  <div className="space-y-2">
                    <Label>Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={formData.color || accountTypeColors[formData.account_type]}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setFormData((prev: CreateAccountInput) => ({ 
                            ...prev, 
                            color: e.target.value 
                          }))
                        }
                        className="w-16 h-10"
                      />
                      <Input
                        placeholder="#000000"
                        value={formData.color || accountTypeColors[formData.account_type]}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setFormData((prev: CreateAccountInput) => ({ 
                            ...prev, 
                            color: e.target.value 
                          }))
                        }
                        className="flex-1"
                      />
                    </div>
                  </div>

                  {/* Default Account Toggle */}
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="default"
                      checked={formData.is_default}
                      onCheckedChange={(checked: boolean) =>
                        setFormData((prev: CreateAccountInput) => ({ 
                          ...prev, 
                          is_default: checked 
                        }))
                      }
                    />
                    <Label htmlFor="default">Set as default account</Label>
                  </div>

                  <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading 
                      ? (editingAccount ? 'Updating...' : 'Creating...') 
                      : (editingAccount ? 'Update Account' : 'Create Account')
                    }
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

      {/* Accounts List */}
      {accounts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Wallet className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 mb-4">No accounts yet</p>
            <p className="text-sm text-gray-500 mb-6">
              Create your first account to start tracking your finances
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((account: Account) => (
            <Card key={account.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center">
                    <div 
                      className="w-4 h-4 rounded-full mr-2"
                      style={{ backgroundColor: account.color || '#6b7280' }}
                    />
                    <CardTitle className="text-lg flex items-center">
                      {account.name}
                      {account.is_default && (
                        <Star className="w-4 h-4 ml-2 text-yellow-500 fill-current" />
                      )}
                    </CardTitle>
                  </div>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(account)}
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
                          <AlertDialogTitle>Delete Account</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{account.name}"? 
                            This action cannot be undone and will affect all related transactions.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(account.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Account Type */}
                  <div className="flex items-center">
                    {accountTypeIcons[account.account_type]}
                    <Badge variant="secondary" className="ml-2 capitalize">
                      {account.account_type}
                    </Badge>
                  </div>

                  {/* Balance */}
                  <div>
                    <p className="text-sm text-gray-600">Current Balance</p>
                    <p className={`text-2xl font-bold ${
                      account.balance >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(account.balance)}
                    </p>
                  </div>

                  {/* Initial Balance */}
                  <div>
                    <p className="text-xs text-gray-500">
                      Initial Balance: {formatCurrency(account.initial_balance)}
                    </p>
                  </div>

                  {/* Currency */}
                  <div>
                    <p className="text-xs text-gray-500">
                      Currency: {account.currency}
                    </p>
                  </div>

                  {/* Created Date */}
                  <div>
                    <p className="text-xs text-gray-500">
                      Created: {account.created_at.toLocaleDateString('id-ID')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}