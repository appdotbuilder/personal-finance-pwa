import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Target, 
  PlusCircle, 
  Edit, 
  Calendar,
  TrendingUp,
  TrendingDown,
  AlertTriangle
} from 'lucide-react';
import { trpc } from '@/utils/trpc';
// Type definitions
type CategoryType = 'income' | 'expense';

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

interface CreateBudgetInput {
  category_id: string;
  name: string;
  amount: number;
  period_start: Date;
  period_end: Date;
}

interface UpdateBudgetInput {
  id: string;
  name?: string;
  amount?: number;
  period_start?: Date;
  period_end?: Date;
  is_active?: boolean;
}

interface BudgetManagerProps {
  onUpdate?: () => void;
}

export function BudgetManager({ onUpdate }: BudgetManagerProps) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  
  const [formData, setFormData] = useState<CreateBudgetInput>({
    category_id: '',
    name: '',
    amount: 0,
    period_start: new Date(),
    period_end: new Date()
  });

  // Load budgets and categories
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [budgetsData, categoriesData] = await Promise.all([
        trpc.getBudgets.query(),
        trpc.getCategories.query()
      ]);
      setBudgets(budgetsData);
      setCategories(categoriesData.filter((cat: Category) => cat.category_type === 'expense'));
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

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

  // Get default period (current month)
  const getDefaultPeriod = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start, end };
  };

  // Reset form
  const resetForm = () => {
    const { start, end } = getDefaultPeriod();
    setFormData({
      category_id: '',
      name: '',
      amount: 0,
      period_start: start,
      period_end: end
    });
    setEditingBudget(null);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.category_id || !formData.name || formData.amount <= 0) return;

    setIsLoading(true);
    try {
      if (editingBudget) {
        // Update existing budget
        await trpc.updateBudget.mutate({
          id: editingBudget.id,
          name: formData.name,
          amount: formData.amount,
          period_start: formData.period_start,
          period_end: formData.period_end
        });
      } else {
        // Create new budget
        await trpc.createBudget.mutate(formData);
      }

      await loadData();
      onUpdate?.();
      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Failed to save budget:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle edit
  const handleEdit = (budget: Budget) => {
    setEditingBudget(budget);
    setFormData({
      category_id: budget.category_id,
      name: budget.name,
      amount: budget.amount,
      period_start: budget.period_start,
      period_end: budget.period_end
    });
    setIsDialogOpen(true);
  };

  // Get category name
  const getCategoryName = (categoryId: string) => {
    const category = categories.find((cat: Category) => cat.id === categoryId);
    return category?.name || 'Unknown Category';
  };

  // Calculate budget status
  const getBudgetStatus = (budget: Budget) => {
    const percentage = (budget.spent / budget.amount) * 100;
    const remaining = budget.amount - budget.spent;
    
    return {
      percentage: Math.min(percentage, 100),
      remaining,
      status: percentage >= 100 ? 'over' : percentage >= 80 ? 'warning' : 'good'
    };
  };

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center">
              <Target className="w-5 h-5 mr-2 text-orange-600" />
              🎯 Budget Management
            </CardTitle>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Create Budget
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>
                    {editingBudget ? 'Edit Budget' : 'Create New Budget'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Budget Name */}
                  <div className="space-y-2">
                    <Label htmlFor="name">Budget Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Monthly Groceries, Entertainment"
                      value={formData.name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData((prev: CreateBudgetInput) => ({ 
                          ...prev, 
                          name: e.target.value 
                        }))
                      }
                      required
                    />
                  </div>

                  {/* Category Selection */}
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select
                      value={formData.category_id}
                      onValueChange={(value: string) =>
                        setFormData((prev: CreateBudgetInput) => ({ 
                          ...prev, 
                          category_id: value 
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category: Category) => (
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

                  {/* Budget Amount */}
                  <div className="space-y-2">
                    <Label htmlFor="amount">Budget Amount (IDR)</Label>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="0"
                      value={formData.amount || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData((prev: CreateBudgetInput) => ({ 
                          ...prev, 
                          amount: parseFloat(e.target.value) || 0 
                        }))
                      }
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>

                  {/* Period */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="start">Period Start</Label>
                      <Input
                        id="start"
                        type="date"
                        value={formData.period_start.toISOString().split('T')[0]}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setFormData((prev: CreateBudgetInput) => ({ 
                            ...prev, 
                            period_start: new Date(e.target.value) 
                          }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end">Period End</Label>
                      <Input
                        id="end"
                        type="date"
                        value={formData.period_end.toISOString().split('T')[0]}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setFormData((prev: CreateBudgetInput) => ({ 
                            ...prev, 
                            period_end: new Date(e.target.value) 
                          }))
                        }
                        required
                      />
                    </div>
                  </div>

                  <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading 
                      ? (editingBudget ? 'Updating...' : 'Creating...') 
                      : (editingBudget ? 'Update Budget' : 'Create Budget')
                    }
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

      {/* Budget Overview */}
      {budgets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
              Budget Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Total Budgeted */}
              <div className="text-center">
                <p className="text-sm text-gray-600">Total Budgeted</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(budgets.reduce((sum, budget) => sum + budget.amount, 0))}
                </p>
              </div>

              {/* Total Spent */}
              <div className="text-center">
                <p className="text-sm text-gray-600">Total Spent</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(budgets.reduce((sum, budget) => sum + budget.spent, 0))}
                </p>
              </div>

              {/* Total Remaining */}
              <div className="text-center">
                <p className="text-sm text-gray-600">Total Remaining</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(budgets.reduce((sum, budget) => sum + (budget.amount - budget.spent), 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Budgets List */}
      {budgets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Target className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 mb-4">No budgets yet</p>
            <p className="text-sm text-gray-500 mb-6">
              Create your first budget to start tracking your spending goals
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {budgets.map((budget: Budget) => {
            const status = getBudgetStatus(budget);
            const categoryName = getCategoryName(budget.category_id);
            
            return (
              <Card key={budget.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{budget.name}</CardTitle>
                      <p className="text-sm text-gray-600">{categoryName}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {status.status === 'over' && (
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(budget)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Budget Progress */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">
                          {formatCurrency(budget.spent)} / {formatCurrency(budget.amount)}
                        </span>
                        <Badge 
                          variant={status.status === 'over' ? 'destructive' : 
                                   status.status === 'warning' ? 'default' : 'secondary'}
                          className={status.status === 'warning' ? 'bg-yellow-100 text-yellow-800' : ''}
                        >
                          {Math.round(status.percentage)}%
                        </Badge>
                      </div>
                      <Progress 
                        value={status.percentage} 
                        className={`h-2 ${status.status === 'over' ? 'bg-red-100' : ''}`}
                      />
                    </div>

                    {/* Remaining Amount */}
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Remaining:</span>
                      <span className={`font-medium ${
                        status.remaining >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatCurrency(status.remaining)}
                      </span>
                    </div>

                    {/* Period */}
                    <div className="flex items-center text-xs text-gray-500">
                      <Calendar className="w-3 h-3 mr-1" />
                      {budget.period_start.toLocaleDateString('id-ID')} - {budget.period_end.toLocaleDateString('id-ID')}
                    </div>

                    {/* Status Message */}
                    <div className="text-xs">
                      {status.status === 'over' && (
                        <p className="text-red-600 flex items-center">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Over budget by {formatCurrency(Math.abs(status.remaining))}
                        </p>
                      )}
                      {status.status === 'warning' && (
                        <p className="text-yellow-600">
                          ⚠️ Nearing budget limit ({Math.round(status.percentage)}% used)
                        </p>
                      )}
                      {status.status === 'good' && (
                        <p className="text-green-600">
                          ✅ On track ({Math.round(status.percentage)}% used)
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}