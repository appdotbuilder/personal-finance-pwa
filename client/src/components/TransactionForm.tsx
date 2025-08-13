import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, PlusCircle, Receipt } from 'lucide-react';
import { trpc } from '@/utils/trpc';
// Type definitions
type TransactionType = 'income' | 'expense' | 'transfer';
type CategoryType = 'income' | 'expense';

interface Account {
  id: string;
  user_id: string;
  name: string;
  account_type: string;
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

interface CreateTransactionInput {
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  transaction_type: TransactionType;
  amount: number;
  description: string;
  notes: string | null;
  receipt_url: string | null;
  transaction_date: Date;
  tags: string[];
}

interface TransactionFormProps {
  onSuccess?: () => void;
  detailed?: boolean;
}

export function TransactionForm({ onSuccess, detailed = false }: TransactionFormProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<CreateTransactionInput>({
    account_id: '',
    to_account_id: null,
    category_id: null,
    transaction_type: 'expense',
    amount: 0,
    description: '',
    notes: null,
    receipt_url: null,
    transaction_date: new Date(),
    tags: []
  });
  const [newTag, setNewTag] = useState('');

  // Load accounts and categories
  const loadData = useCallback(async () => {
    try {
      const [accountsData, categoriesData] = await Promise.all([
        trpc.getAccounts.query(),
        trpc.getCategories.query()
      ]);
      setAccounts(accountsData);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter categories by type
  const filteredCategories = categories.filter(
    (category: Category) => category.category_type === formData.transaction_type
  );

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.account_id || !formData.description || formData.amount <= 0) {
      return;
    }

    setIsLoading(true);
    try {
      await trpc.createTransaction.mutate({
        ...formData,
        category_id: formData.category_id || null,
        to_account_id: formData.to_account_id || null,
        notes: formData.notes || null
      });

      // Reset form
      setFormData({
        account_id: formData.account_id, // Keep same account selected
        to_account_id: null,
        category_id: null,
        transaction_type: 'expense',
        amount: 0,
        description: '',
        notes: null,
        receipt_url: null,
        transaction_date: new Date(),
        tags: []
      });
      setNewTag('');

      onSuccess?.();
    } catch (error) {
      console.error('Failed to create transaction:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle adding tags
  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData((prev: CreateTransactionInput) => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  // Handle removing tags
  const handleRemoveTag = (tagToRemove: string) => {
    setFormData((prev: CreateTransactionInput) => ({
      ...prev,
      tags: prev.tags.filter((tag: string) => tag !== tagToRemove)
    }));
  };

  // Handle transaction type change
  const handleTypeChange = (type: TransactionType) => {
    setFormData((prev: CreateTransactionInput) => ({
      ...prev,
      transaction_type: type,
      category_id: null, // Reset category when type changes
      to_account_id: type === 'transfer' ? prev.to_account_id : null
    }));
  };

  if (!detailed) {
    // Simple form for dashboard quick add
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Select
            value={formData.transaction_type}
            onValueChange={handleTypeChange}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="income">💰 Income</SelectItem>
              <SelectItem value="expense">💸 Expense</SelectItem>
              <SelectItem value="transfer">🔄 Transfer</SelectItem>
            </SelectContent>
          </Select>
          
          <Input
            type="number"
            placeholder="Amount"
            value={formData.amount || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setFormData((prev: CreateTransactionInput) => ({ 
                ...prev, 
                amount: parseFloat(e.target.value) || 0 
              }))
            }
            min="0"
            step="0.01"
            required
          />
        </div>

        <Input
          placeholder="Description"
          value={formData.description}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setFormData((prev: CreateTransactionInput) => ({ 
              ...prev, 
              description: e.target.value 
            }))
          }
          required
        />

        <div className="grid grid-cols-1 gap-2">
          <Select
            value={formData.account_id}
            onValueChange={(value: string) =>
              setFormData((prev: CreateTransactionInput) => ({ 
                ...prev, 
                account_id: value 
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account: Account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button 
          type="submit" 
          disabled={isLoading || !formData.account_id || !formData.description || formData.amount <= 0}
          className="w-full"
        >
          <PlusCircle className="w-4 h-4 mr-2" />
          {isLoading ? 'Adding...' : 'Add Transaction'}
        </Button>
      </form>
    );
  }

  // Detailed form
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Transaction Type */}
      <div className="space-y-2">
        <Label>Transaction Type</Label>
        <Select
          value={formData.transaction_type}
          onValueChange={handleTypeChange}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="income">💰 Income</SelectItem>
            <SelectItem value="expense">💸 Expense</SelectItem>
            <SelectItem value="transfer">🔄 Transfer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Amount and Date */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="amount">Amount (IDR)</Label>
          <Input
            id="amount"
            type="number"
            placeholder="0"
            value={formData.amount || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setFormData((prev: CreateTransactionInput) => ({ 
                ...prev, 
                amount: parseFloat(e.target.value) || 0 
              }))
            }
            min="0"
            step="0.01"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            type="date"
            value={formData.transaction_date.toISOString().split('T')[0]}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setFormData((prev: CreateTransactionInput) => ({ 
                ...prev, 
                transaction_date: new Date(e.target.value) 
              }))
            }
            required
          />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          placeholder="What's this transaction for?"
          value={formData.description}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setFormData((prev: CreateTransactionInput) => ({ 
              ...prev, 
              description: e.target.value 
            }))
          }
          required
        />
      </div>

      {/* Account Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>
            {formData.transaction_type === 'transfer' ? 'From Account' : 'Account'}
          </Label>
          <Select
            value={formData.account_id}
            onValueChange={(value: string) =>
              setFormData((prev: CreateTransactionInput) => ({ 
                ...prev, 
                account_id: value 
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account: Account) => (
                <SelectItem key={account.id} value={account.id}>
                  <div className="flex items-center">
                    <div 
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: account.color || '#6b7280' }}
                    />
                    {account.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* To Account for transfers */}
        {formData.transaction_type === 'transfer' && (
          <div className="space-y-2">
            <Label>To Account</Label>
            <Select
              value={formData.to_account_id || ''}
              onValueChange={(value: string) =>
                setFormData((prev: CreateTransactionInput) => ({ 
                  ...prev, 
                  to_account_id: value 
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select destination account" />
              </SelectTrigger>
              <SelectContent>
                {accounts
                  .filter((account: Account) => account.id !== formData.account_id)
                  .map((account: Account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex items-center">
                        <div 
                          className="w-3 h-3 rounded-full mr-2"
                          style={{ backgroundColor: account.color || '#6b7280' }}
                        />
                        {account.name}
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Category Selection */}
      {formData.transaction_type !== 'transfer' && (
        <div className="space-y-2">
          <Label>Category</Label>
          <Select
            value={formData.category_id || ''}
            onValueChange={(value: string) =>
              setFormData((prev: CreateTransactionInput) => ({ 
                ...prev, 
                category_id: value 
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category (optional)" />
            </SelectTrigger>
            <SelectContent>
              {filteredCategories.map((category: Category) => (
                <SelectItem key={category.id} value={category.id}>
                  <div className="flex items-center">
                    <div 
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: category.color || '#6b7280' }}
                    />
                    {category.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notes (Optional)</Label>
        <Textarea
          id="notes"
          placeholder="Additional details about this transaction..."
          value={formData.notes || ''}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            setFormData((prev: CreateTransactionInput) => ({ 
              ...prev, 
              notes: e.target.value || null 
            }))
          }
          rows={3}
        />
      </div>

      {/* Tags */}
      <div className="space-y-3">
        <Label>Tags</Label>
        <div className="flex gap-2">
          <Input
            placeholder="Add tag..."
            value={newTag}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTag(e.target.value)}
            onKeyPress={(e: React.KeyboardEvent) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddTag();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={handleAddTag}>
            Add
          </Button>
        </div>
        {formData.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {formData.tags.map((tag: string, index: number) => (
              <Badge 
                key={index} 
                variant="secondary" 
                className="cursor-pointer"
                onClick={() => handleRemoveTag(tag)}
              >
                {tag} ✕
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Submit Button */}
      <Button 
        type="submit" 
        disabled={isLoading || !formData.account_id || !formData.description || formData.amount <= 0}
        className="w-full"
        size="lg"
      >
        <PlusCircle className="w-4 h-4 mr-2" />
        {isLoading ? 'Adding Transaction...' : 'Add Transaction'}
      </Button>
    </form>
  );
}