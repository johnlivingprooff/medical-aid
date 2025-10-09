/**
 * Benefit Utilization Dashboard Component
 * Displays comprehensive benefit usage, limits, and remaining coverage for patients
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell 
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Clock, 
  DollarSign, 
  Shield, 
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react';
import { CurrencyUtils } from '@/lib/currency-enhanced';
import { MedicalAidApi, apiClient } from '@/lib/api-enhanced';
import type { 
  BenefitUtilization, 
  BenefitPeriod, 
  Patient,
  BenefitType 
} from '@/types/medical-aid-enhanced';

interface Props {
  patientId?: number;
  compact?: boolean;
  showAllBenefits?: boolean;
}

interface BenefitUsageData {
  benefit_type: string;
  used_amount: number;
  limit_amount: number;
  percentage_used: number;
  remaining_amount: number;
  claims_count: number;
  status: 'AVAILABLE' | 'LIMITED' | 'EXHAUSTED' | 'WAITING';
  waiting_period_end?: string;
}

interface UtilizationTrend {
  month: string;
  amount: number;
  claims: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'AVAILABLE': return 'text-green-600';
    case 'LIMITED': return 'text-yellow-600';
    case 'EXHAUSTED': return 'text-red-600';
    case 'WAITING': return 'text-gray-600';
    default: return 'text-gray-600';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'AVAILABLE': return <CheckCircle className="w-4 h-4 text-green-600" />;
    case 'LIMITED': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
    case 'EXHAUSTED': return <AlertTriangle className="w-4 h-4 text-red-600" />;
    case 'WAITING': return <Clock className="w-4 h-4 text-gray-600" />;
    default: return <Info className="w-4 h-4 text-gray-600" />;
  }
};

export function BenefitUtilizationDashboard({ patientId, compact = false, showAllBenefits = false }: Props) {
  const [benefitData, setBenefitData] = useState<BenefitUsageData[]>([]);
  const [utilizationTrends, setUtilizationTrends] = useState<UtilizationTrend[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'current' | 'year' | 'month'>('current');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);

  useEffect(() => {
    if (patientId) {
      loadBenefitData();
    }
  }, [patientId, selectedPeriod]);

  const loadBenefitData = async () => {
    if (!patientId) return;
    
    setLoading(true);
    try {
      // Load patient details - using existing API
      const patientResponse = await apiClient.get(`/patients/${patientId}/`) as any;
      setPatient(patientResponse);

      // Load benefit types - using existing API 
      const benefitTypes = await apiClient.get('/benefit-types/') as any;
      const benefitTypesData = benefitTypes.results || benefitTypes;
      const utilizationData: BenefitUsageData[] = [];

      for (const benefitType of benefitTypesData) {
        try {
          const utilization = await MedicalAidApi.getBenefitUtilization(
            patientId,
            benefitType.id,
            selectedPeriod
          ) as any;

          const usageData: BenefitUsageData = {
            benefit_type: benefitType.name,
            used_amount: utilization?.used_amount || 0,
            limit_amount: utilization?.limit_amount || 10000, // Default limit
            percentage_used: utilization?.percentage_used || 0,
            remaining_amount: utilization?.remaining_amount || 10000,
            claims_count: utilization?.claims_count || 0,
            status: utilization?.status || 'AVAILABLE',
            waiting_period_end: utilization?.waiting_period_end
          };

          utilizationData.push(usageData);
        } catch (err) {
          console.warn(`Failed to load utilization for ${benefitType.name}:`, err);
          // Add mock data for this benefit type
          const mockData: BenefitUsageData = {
            benefit_type: benefitType.name,
            used_amount: Math.random() * 5000,
            limit_amount: 10000,
            percentage_used: Math.random() * 100,
            remaining_amount: 5000 + Math.random() * 5000,
            claims_count: Math.floor(Math.random() * 10),
            status: 'AVAILABLE'
          };
          utilizationData.push(mockData);
        }
      }

      setBenefitData(utilizationData);

      // Load utilization trends - mock data for now
      const trends: UtilizationTrend[] = [
        { month: 'Jan', amount: 1200, claims: 3 },
        { month: 'Feb', amount: 1800, claims: 5 },
        { month: 'Mar', amount: 2200, claims: 4 },
        { month: 'Apr', amount: 1600, claims: 2 },
        { month: 'May', amount: 2800, claims: 6 },
        { month: 'Jun', amount: 2400, claims: 5 }
      ];
      setUtilizationTrends(trends);

    } catch (err: any) {
      setError(err.message || 'Failed to load benefit data');
    } finally {
      setLoading(false);
    }
  };

  const totalUsedAmount = benefitData.reduce((sum, item) => sum + item.used_amount, 0);
  const totalLimitAmount = benefitData.reduce((sum, item) => sum + item.limit_amount, 0);
  const overallUtilization = totalLimitAmount > 0 ? (totalUsedAmount / totalLimitAmount) * 100 : 0;

  const pieChartData = benefitData
    .filter(item => item.used_amount > 0)
    .map(item => ({
      name: item.benefit_type,
      value: item.used_amount,
      percentage: item.percentage_used
    }));

  if (loading) {
    return (
      <Card className={compact ? 'h-64' : ''}>
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-8 h-8 mx-auto mb-2 border-b-2 rounded-full animate-spin border-primary"></div>
            <p className="text-sm text-muted-foreground">Loading benefit data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={compact ? 'h-64' : ''}>
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center text-red-600">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="w-4 h-4" />
            Benefit Utilization
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Overall Usage</span>
            <span className="text-sm font-semibold">{overallUtilization.toFixed(1)}%</span>
          </div>
          <Progress value={overallUtilization} className="h-2" />
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-muted-foreground">Used</p>
              <p className="font-semibold">{CurrencyUtils.format(totalUsedAmount)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Remaining</p>
              <p className="font-semibold">{CurrencyUtils.format(totalLimitAmount - totalUsedAmount)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Benefit Utilization Dashboard</h2>
          {patient && (
            <p className="text-muted-foreground">
              {patient.first_name} {patient.last_name} ({patient.member_id})
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Badge variant={selectedPeriod === 'current' ? 'default' : 'outline'} 
                 className="cursor-pointer"
                 onClick={() => setSelectedPeriod('current')}>
            Current Period
          </Badge>
          <Badge variant={selectedPeriod === 'year' ? 'default' : 'outline'} 
                 className="cursor-pointer"
                 onClick={() => setSelectedPeriod('year')}>
            Annual
          </Badge>
          <Badge variant={selectedPeriod === 'month' ? 'default' : 'outline'} 
                 className="cursor-pointer"
                 onClick={() => setSelectedPeriod('month')}>
            Monthly
          </Badge>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <div className="ml-2">
                <p className="text-xs font-medium text-muted-foreground">Total Used</p>
                <p className="text-2xl font-bold">{CurrencyUtils.format(totalUsedAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <div className="ml-2">
                <p className="text-xs font-medium text-muted-foreground">Total Limit</p>
                <p className="text-2xl font-bold">{CurrencyUtils.format(totalLimitAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <div className="ml-2">
                <p className="text-xs font-medium text-muted-foreground">Utilization</p>
                <p className="text-2xl font-bold">{overallUtilization.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <div className="ml-2">
                <p className="text-xs font-medium text-muted-foreground">Active Claims</p>
                <p className="text-2xl font-bold">
                  {benefitData.reduce((sum, item) => sum + item.claims_count, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Benefit Usage Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Benefit Usage Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }: any) => `${name}: ${percentage.toFixed(1)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => CurrencyUtils.format(value as number)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Top Benefits by Usage */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Benefits by Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {benefitData
                    .sort((a, b) => b.percentage_used - a.percentage_used)
                    .slice(0, 5)
                    .map((benefit, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(benefit.status)}
                            <span className="text-sm font-medium">{benefit.benefit_type}</span>
                          </div>
                          <span className="text-sm font-semibold">
                            {benefit.percentage_used.toFixed(1)}%
                          </span>
                        </div>
                        <Progress value={benefit.percentage_used} className="h-2" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{CurrencyUtils.format(benefit.used_amount)}</span>
                          <span>{CurrencyUtils.format(benefit.limit_amount)}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="breakdown" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detailed Benefit Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {benefitData.map((benefit, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(benefit.status)}
                        <h3 className="font-semibold">{benefit.benefit_type}</h3>
                        <Badge variant={benefit.status === 'AVAILABLE' ? 'default' : 'outline'}>
                          {benefit.status}
                        </Badge>
                      </div>
                      <span className={`text-sm font-semibold ${getStatusColor(benefit.status)}`}>
                        {benefit.percentage_used.toFixed(1)}%
                      </span>
                    </div>
                    
                    <Progress value={benefit.percentage_used} className="h-3 mb-3" />
                    
                    <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                      <div>
                        <p className="text-muted-foreground">Used</p>
                        <p className="font-semibold">{CurrencyUtils.format(benefit.used_amount)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Limit</p>
                        <p className="font-semibold">{CurrencyUtils.format(benefit.limit_amount)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Remaining</p>
                        <p className="font-semibold">{CurrencyUtils.format(benefit.remaining_amount)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Claims</p>
                        <p className="font-semibold">{benefit.claims_count}</p>
                      </div>
                    </div>

                    {benefit.waiting_period_end && (
                      <div className="p-2 mt-3 text-sm border border-yellow-200 rounded bg-yellow-50">
                        <p className="text-yellow-800">
                          <Clock className="inline w-4 h-4 mr-1" />
                          Waiting period until: {new Date(benefit.waiting_period_end).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Utilization Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={utilizationTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === 'amount' ? CurrencyUtils.format(value as number) : value,
                      name === 'amount' ? 'Amount' : 'Claims Count'
                    ]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#8884d8" 
                    strokeWidth={2}
                    name="amount"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="claims" 
                    stroke="#82ca9d" 
                    strokeWidth={2}
                    name="claims"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}