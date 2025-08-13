import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Brain, 
  TrendingUp, 
  Lightbulb, 
  Target,
  RefreshCw,
  Star,
  AlertTriangle,
  CheckCircle,
  Zap
} from 'lucide-react';
import { trpc } from '@/utils/trpc';
// Type definitions
interface AiInsight {
  spending_insights: string[];
  budget_recommendations: string[];
  savings_suggestions: string[];
  financial_health_score: number;
  generated_at: Date;
}

export function AiInsights() {
  const [insights, setInsights] = useState<AiInsight | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Load AI insights
  const loadInsights = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await trpc.getAiInsights.query();
      setInsights(data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to load AI insights:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  // Get health score color and message
  const getHealthScoreInfo = (score: number) => {
    if (score >= 80) {
      return {
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        icon: <CheckCircle className="w-5 h-5" />,
        message: 'Excellent financial health!',
        description: 'You\'re doing great with your money management.'
      };
    } else if (score >= 60) {
      return {
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-100',
        icon: <Star className="w-5 h-5" />,
        message: 'Good financial health',
        description: 'You\'re on the right track, with room for improvement.'
      };
    } else if (score >= 40) {
      return {
        color: 'text-orange-600',
        bgColor: 'bg-orange-100',
        icon: <AlertTriangle className="w-5 h-5" />,
        message: 'Fair financial health',
        description: 'Consider making some adjustments to improve your finances.'
      };
    } else {
      return {
        color: 'text-red-600',
        bgColor: 'bg-red-100',
        icon: <AlertTriangle className="w-5 h-5" />,
        message: 'Needs attention',
        description: 'Focus on improving your financial habits.'
      };
    }
  };

  if (isLoading && !insights) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Generating AI insights...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center">
              <Brain className="w-5 h-5 mr-2 text-purple-600" />
              🤖 AI-Powered Financial Insights
            </CardTitle>
            <Button onClick={loadInsights} disabled={isLoading} variant="outline">
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh Insights
            </Button>
          </div>
          {lastUpdated && (
            <p className="text-sm text-gray-600">
              Last updated: {lastUpdated.toLocaleString('id-ID')}
            </p>
          )}
        </CardHeader>
      </Card>

      {insights ? (
        <>
          {/* Financial Health Score */}
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full -mr-16 -mt-16"></div>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Zap className="w-5 h-5 mr-2 text-purple-600" />
                Financial Health Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-6">
                <div className="flex-1">
                  <div className="flex items-center space-x-4 mb-4">
                    <div className={`p-3 rounded-full ${getHealthScoreInfo(insights.financial_health_score).bgColor}`}>
                      <div className={getHealthScoreInfo(insights.financial_health_score).color}>
                        {getHealthScoreInfo(insights.financial_health_score).icon}
                      </div>
                    </div>
                    <div>
                      <h3 className={`text-2xl font-bold ${getHealthScoreInfo(insights.financial_health_score).color}`}>
                        {insights.financial_health_score}/100
                      </h3>
                      <p className="font-medium">{getHealthScoreInfo(insights.financial_health_score).message}</p>
                      <p className="text-sm text-gray-600">
                        {getHealthScoreInfo(insights.financial_health_score).description}
                      </p>
                    </div>
                  </div>
                  <Progress value={insights.financial_health_score} className="h-3" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Insights Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Spending Insights */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
                  💸 Spending Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                {insights.spending_insights.length === 0 ? (
                  <p className="text-gray-500 text-sm">No spending insights available yet.</p>
                ) : (
                  <div className="space-y-3">
                    {insights.spending_insights.map((insight: string, index: number) => (
                      <Alert key={index} className="border-blue-200 bg-blue-50">
                        <AlertDescription className="text-sm">
                          <span className="font-medium text-blue-800">💡 Insight:</span>
                          <br />
                          {insight}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Budget Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <Target className="w-5 h-5 mr-2 text-orange-600" />
                  🎯 Budget Tips
                </CardTitle>
              </CardHeader>
              <CardContent>
                {insights.budget_recommendations.length === 0 ? (
                  <p className="text-gray-500 text-sm">No budget recommendations available yet.</p>
                ) : (
                  <div className="space-y-3">
                    {insights.budget_recommendations.map((recommendation: string, index: number) => (
                      <Alert key={index} className="border-orange-200 bg-orange-50">
                        <AlertDescription className="text-sm">
                          <span className="font-medium text-orange-800">🎯 Recommendation:</span>
                          <br />
                          {recommendation}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Savings Suggestions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <Lightbulb className="w-5 h-5 mr-2 text-green-600" />
                  💰 Savings Ideas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {insights.savings_suggestions.length === 0 ? (
                  <p className="text-gray-500 text-sm">No savings suggestions available yet.</p>
                ) : (
                  <div className="space-y-3">
                    {insights.savings_suggestions.map((suggestion: string, index: number) => (
                      <Alert key={index} className="border-green-200 bg-green-50">
                        <AlertDescription className="text-sm">
                          <span className="font-medium text-green-800">💡 Suggestion:</span>
                          <br />
                          {suggestion}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* AI Explanation */}
          <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
            <CardHeader>
              <CardTitle className="flex items-center text-purple-800">
                <Brain className="w-5 h-5 mr-2" />
                How AI Insights Work
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-purple-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-2">🔍 Analysis Process</h4>
                  <ul className="space-y-1 text-xs">
                    <li>• Analyzes your transaction patterns</li>
                    <li>• Compares spending across categories</li>
                    <li>• Evaluates budget performance</li>
                    <li>• Tracks savings progress</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">💡 Personalized Advice</h4>
                  <ul className="space-y-1 text-xs">
                    <li>• Identifies spending trends</li>
                    <li>• Suggests optimization opportunities</li>
                    <li>• Recommends budget adjustments</li>
                    <li>• Provides actionable savings tips</li>
                  </ul>
                </div>
              </div>
              <div className="mt-4 p-3 bg-purple-100 rounded-lg">
                <p className="text-xs">
                  <strong>Note:</strong> AI insights are generated based on your financial data and general best practices. 
                  Always consider your personal circumstances when making financial decisions.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Quick Action Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CheckCircle className="w-5 h-5 mr-2 text-indigo-600" />
                ✅ Action Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Based on health score, show different action items */}
                {insights.financial_health_score < 60 && (
                  <Alert className="border-red-200 bg-red-50">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                      <strong>Priority:</strong> Review and optimize your budget to improve financial health.
                    </AlertDescription>
                  </Alert>
                )}
                
                {insights.budget_recommendations.length > 0 && (
                  <Alert className="border-orange-200 bg-orange-50">
                    <Target className="h-4 w-4 text-orange-600" />
                    <AlertDescription className="text-orange-800">
                      <strong>Budgeting:</strong> Implement the budget recommendations provided above.
                    </AlertDescription>
                  </Alert>
                )}

                {insights.savings_suggestions.length > 0 && (
                  <Alert className="border-green-200 bg-green-50">
                    <Lightbulb className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      <strong>Savings:</strong> Try implementing at least one savings suggestion this week.
                    </AlertDescription>
                  </Alert>
                )}

                {insights.financial_health_score >= 80 && (
                  <Alert className="border-blue-200 bg-blue-50">
                    <Star className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800">
                      <strong>Great job!</strong> Maintain your excellent financial habits and consider advanced strategies.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Brain className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 mb-4">No AI insights available yet</p>
            <p className="text-sm text-gray-500 mb-6">
              Add some transactions and budgets to get personalized financial insights
            </p>
            <Button onClick={loadInsights} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Generate Insights
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}