import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
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
  Star,
  Trophy
} from 'lucide-react';
import { trpc } from '@/utils/trpc';
// Type definitions
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

interface CreateSavingsGoalInput {
  account_id: string;
  name: string;
  description: string | null;
  target_amount: number;
  target_date: Date | null;
}

interface UpdateSavingsGoalInput {
  id: string;
  name?: string;
  description?: string | null;
  target_amount?: number;
  target_date?: Date | null;
  status?: GoalStatus;
}

interface SavingsGoalManagerProps {
  onUpdate?: () => void;
}

const goalStatusColors: Record<GoalStatus, string> = {
  active: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  paused: 'bg-gray-100 text-gray-800'
};

const goalStatusIcons = {
  active: <TrendingUp className="w-3 h-3" />,
  completed: <Trophy className="w-3 h-3" />,
  paused: <Target className="w-3 h-3" />
};

export function SavingsGoalManager({ onUpdate }: SavingsGoalManagerProps) {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  
  const [formData, setFormData] = useState<CreateSavingsGoalInput>({
    account_id: '',
    name: '',
    description: null,
    target_amount: 0,
    target_date: null
  });

  // Load goals and accounts
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [goalsData, accountsData] = await Promise.all([
        trpc.getSavingsGoals.query(),
        trpc.getAccounts.query()
      ]);
      setGoals(goalsData);
      setAccounts(accountsData);
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

  // Reset form
  const resetForm = () => {
    setFormData({
      account_id: '',
      name: '',
      description: null,
      target_amount: 0,
      target_date: null
    });
    setEditingGoal(null);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.account_id || !formData.name || formData.target_amount <= 0) return;

    setIsLoading(true);
    try {
      if (editingGoal) {
        // Update existing goal
        await trpc.updateSavingsGoal.mutate({
          id: editingGoal.id,
          name: formData.name,
          description: formData.description,
          target_amount: formData.target_amount,
          target_date: formData.target_date
        });
      } else {
        // Create new goal
        await trpc.createSavingsGoal.mutate(formData);
      }

      await loadData();
      onUpdate?.();
      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Failed to save goal:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle edit
  const handleEdit = (goal: SavingsGoal) => {
    setEditingGoal(goal);
    setFormData({
      account_id: goal.account_id,
      name: goal.name,
      description: goal.description,
      target_amount: goal.target_amount,
      target_date: goal.target_date
    });
    setIsDialogOpen(true);
  };

  // Get account name
  const getAccountName = (accountId: string) => {
    const account = accounts.find((acc: Account) => acc.id === accountId);
    return account?.name || 'Unknown Account';
  };

  // Calculate goal progress
  const getGoalProgress = (goal: SavingsGoal) => {
    const percentage = (goal.current_amount / goal.target_amount) * 100;
    const remaining = goal.target_amount - goal.current_amount;
    
    return {
      percentage: Math.min(percentage, 100),
      remaining,
      isCompleted: goal.current_amount >= goal.target_amount
    };
  };

  // Calculate days until target
  const getDaysUntilTarget = (targetDate: Date | null) => {
    if (!targetDate) return null;
    const now = new Date();
    const timeDiff = targetDate.getTime() - now.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    return daysDiff;
  };

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center">
              <Target className="w-5 h-5 mr-2 text-indigo-600" />
              💎 Savings Goals
            </CardTitle>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Create Goal
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>
                    {editingGoal ? 'Edit Savings Goal' : 'Create New Savings Goal'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Goal Name */}
                  <div className="space-y-2">
                    <Label htmlFor="name">Goal Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Emergency Fund, New Car, Vacation"
                      value={formData.name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData((prev: CreateSavingsGoalInput) => ({ 
                          ...prev, 
                          name: e.target.value 
                        }))
                      }
                      required
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe your savings goal..."
                      value={formData.description || ''}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        setFormData((prev: CreateSavingsGoalInput) => ({ 
                          ...prev, 
                          description: e.target.value || null 
                        }))
                      }
                      rows={3}
                    />
                  </div>

                  {/* Account Selection */}
                  <div className="space-y-2">
                    <Label>Savings Account</Label>
                    <Select
                      value={formData.account_id}
                      onValueChange={(value: string) =>
                        setFormData((prev: CreateSavingsGoalInput) => ({ 
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

                  {/* Target Amount */}
                  <div className="space-y-2">
                    <Label htmlFor="amount">Target Amount (IDR)</Label>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="0"
                      value={formData.target_amount || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData((prev: CreateSavingsGoalInput) => ({ 
                          ...prev, 
                          target_amount: parseFloat(e.target.value) || 0 
                        }))
                      }
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>

                  {/* Target Date */}
                  <div className="space-y-2">
                    <Label htmlFor="date">Target Date (Optional)</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.target_date?.toISOString().split('T')[0] || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData((prev: CreateSavingsGoalInput) => ({ 
                          ...prev, 
                          target_date: e.target.value ? new Date(e.target.value) : null
                        }))
                      }
                    />
                  </div>

                  <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading 
                      ? (editingGoal ? 'Updating...' : 'Creating...') 
                      : (editingGoal ? 'Update Goal' : 'Create Goal')
                    }
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

      {/* Goals Overview */}
      {goals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
              Goals Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Total Goals */}
              <div className="text-center">
                <p className="text-sm text-gray-600">Total Goals</p>
                <p className="text-2xl font-bold text-blue-600">
                  {goals.length}
                </p>
              </div>

              {/* Active Goals */}
              <div className="text-center">
                <p className="text-sm text-gray-600">Active Goals</p>
                <p className="text-2xl font-bold text-green-600">
                  {goals.filter(goal => goal.status === 'active').length}
                </p>
              </div>

              {/* Total Target */}
              <div className="text-center">
                <p className="text-sm text-gray-600">Total Target</p>
                <p className="text-2xl font-bold text-purple-600">
                  {formatCurrency(goals.reduce((sum, goal) => sum + goal.target_amount, 0))}
                </p>
              </div>

              {/* Total Saved */}
              <div className="text-center">
                <p className="text-sm text-gray-600">Total Saved</p>
                <p className="text-2xl font-bold text-indigo-600">
                  {formatCurrency(goals.reduce((sum, goal) => sum + goal.current_amount, 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Goals List */}
      {goals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Target className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 mb-4">No savings goals yet</p>
            <p className="text-sm text-gray-500 mb-6">
              Create your first savings goal to start building towards your dreams
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {goals.map((goal: SavingsGoal) => {
            const progress = getGoalProgress(goal);
            const accountName = getAccountName(goal.account_id);
            const daysUntilTarget = getDaysUntilTarget(goal.target_date);
            
            return (
              <Card key={goal.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg flex items-center">
                        {goal.name}
                        {progress.isCompleted && (
                          <Trophy className="w-4 h-4 ml-2 text-yellow-500" />
                        )}
                      </CardTitle>
                      <p className="text-sm text-gray-600">{accountName}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge 
                        variant="secondary" 
                        className={goalStatusColors[goal.status]}
                      >
                        {goalStatusIcons[goal.status]}
                        <span className="ml-1 capitalize">{goal.status}</span>
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(goal)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Description */}
                    {goal.description && (
                      <p className="text-sm text-gray-600">{goal.description}</p>
                    )}

                    {/* Progress */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">
                          {formatCurrency(goal.current_amount)} / {formatCurrency(goal.target_amount)}
                        </span>
                        <Badge 
                          variant={progress.isCompleted ? 'default' : 'secondary'}
                          className={progress.isCompleted ? 'bg-green-100 text-green-800' : ''}
                        >
                          {Math.round(progress.percentage)}%
                        </Badge>
                      </div>
                      <Progress value={progress.percentage} className="h-2" />
                    </div>

                    {/* Remaining Amount */}
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">
                        {progress.isCompleted ? 'Goal Achieved!' : 'Remaining:'}
                      </span>
                      {!progress.isCompleted && (
                        <span className="font-medium text-blue-600">
                          {formatCurrency(progress.remaining)}
                        </span>
                      )}
                    </div>

                    {/* Target Date and Days Remaining */}
                    {goal.target_date && (
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <div className="flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          Target: {goal.target_date.toLocaleDateString('id-ID')}
                        </div>
                        {daysUntilTarget !== null && (
                          <div className={`font-medium ${
                            daysUntilTarget < 0 ? 'text-red-600' : 
                            daysUntilTarget < 30 ? 'text-yellow-600' : 'text-green-600'
                          }`}>
                            {daysUntilTarget < 0 
                              ? `${Math.abs(daysUntilTarget)} days overdue`
                              : `${daysUntilTarget} days left`
                            }
                          </div>
                        )}
                      </div>
                    )}

                    {/* Created Date */}
                    <div className="text-xs text-gray-500">
                      Created: {goal.created_at.toLocaleDateString('id-ID')}
                    </div>

                    {/* Achievement Message */}
                    {progress.isCompleted && (
                      <div className="text-center p-2 bg-green-50 rounded-lg">
                        <p className="text-sm text-green-800 font-medium">
                          🎉 Congratulations! Goal achieved!
                        </p>
                      </div>
                    )}
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