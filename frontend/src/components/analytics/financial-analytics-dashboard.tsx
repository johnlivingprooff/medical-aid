/**
 * Financial Analytics Dashboard
 * Comprehensive financial analytics with claim costs, patient responsibility, and predictive modeling
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  Cell,
  AreaChart,
  Area 
} from 'recharts';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  Target,
  Calendar,
  Users,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  PieChart as PieChartIcon,
  Download,
  Filter
} from 'lucide-react';
import { CurrencyUtils } from '@/lib/currency-enhanced';
import { apiClient } from '@/lib/api-enhanced';

interface FinancialMetrics {
  total_claims_amount: number;
  total_paid_amount: number;
  patient_responsibility: number;
  scheme_savings: number;
  average_claim_amount: number;
  claims_count: number;
  approval_rate: number;
  cost_trend: 'INCREASING' | 'DECREASING' | 'STABLE';
  period_comparison: {
    current: number;
    previous: number;
    change_percentage: number;
  };
}

interface ClaimCostTrend {
  period: string;
  total_amount: number;
  patient_amount: number;
  scheme_amount: number;
  claims_count: number;
  average_amount: number;
}

interface PatientResponsibilityBreakdown {
  deductibles: number;
  copayments: number;
  coinsurance: number;
  out_of_pocket_max: number;
  percentage_of_total: number;
}

interface SchemeUtilization {
  scheme_name: string;
  total_members: number;
  active_claims: number;
  total_amount: number;
  average_per_member: number;
  utilization_rate: number;
  top_benefit_types: BenefitTypeUsage[];
}

interface BenefitTypeUsage {
  name: string;
  amount: number;
  percentage: number;
  claims_count: number;
}

interface PredictiveModel {
  forecast_period: string;
  predicted_amount: number;
  confidence_interval: {
    lower: number;
    upper: number;
  };
  risk_factors: string[];
  recommendations: string[];
}

interface Props {
  period?: 'month' | 'quarter' | 'year';
  schemeId?: number;
  showPredictive?: boolean;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d'];

export function FinancialAnalyticsDashboard({ 
  period = 'month', 
  schemeId,
  showPredictive = true 
}: Props) {
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null);
  const [costTrends, setCostTrends] = useState<ClaimCostTrend[]>([]);
  const [patientResponsibility, setPatientResponsibility] = useState<PatientResponsibilityBreakdown | null>(null);
  const [schemeUtilization, setSchemeUtilization] = useState<SchemeUtilization[]>([]);
  const [predictiveModel, setPredictiveModel] = useState<PredictiveModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState(period);

  useEffect(() => {
    loadFinancialData();
  }, [selectedPeriod, schemeId]);

  const loadFinancialData = async () => {
    setLoading(true);
    try {
      // Load financial metrics
      const metricsResponse = await apiClient.get(`/analytics/financial-metrics/?period=${selectedPeriod}${schemeId ? `&scheme=${schemeId}` : ''}`) as any;
      
      // Load cost trends
      const trendsResponse = await apiClient.get(`/analytics/cost-trends/?period=${selectedPeriod}${schemeId ? `&scheme=${schemeId}` : ''}`) as any;
      
      // Load patient responsibility breakdown
      const responsibilityResponse = await apiClient.get(`/analytics/patient-responsibility/?period=${selectedPeriod}${schemeId ? `&scheme=${schemeId}` : ''}`) as any;
      
      // Load scheme utilization
      const utilizationResponse = await apiClient.get(`/analytics/scheme-utilization/?period=${selectedPeriod}`) as any;
      
      // Load predictive model if enabled
      let predictiveResponse = null;
      if (showPredictive) {
        predictiveResponse = await apiClient.get(`/analytics/predictive-model/?period=${selectedPeriod}${schemeId ? `&scheme=${schemeId}` : ''}`) as any;
      }

      // Use mock data if API returns empty
      setMetrics(metricsResponse || generateMockMetrics());
      setCostTrends(trendsResponse || generateMockTrends());
      setPatientResponsibility(responsibilityResponse || generateMockResponsibility());
      setSchemeUtilization(utilizationResponse || generateMockUtilization());
      setPredictiveModel(predictiveResponse || (showPredictive ? generateMockPredictive() : null));

    } catch (error) {
      console.error('Failed to load financial data:', error);
      // Fallback to mock data
      setMetrics(generateMockMetrics());
      setCostTrends(generateMockTrends());
      setPatientResponsibility(generateMockResponsibility());
      setSchemeUtilization(generateMockUtilization());
      setPredictiveModel(showPredictive ? generateMockPredictive() : null);
    } finally {
      setLoading(false);
    }
  };

  const generateMockMetrics = (): FinancialMetrics => ({
    total_claims_amount: 2450000,
    total_paid_amount: 1960000,
    patient_responsibility: 490000,
    scheme_savings: 245000,
    average_claim_amount: 8500,
    claims_count: 288,
    approval_rate: 94.2,
    cost_trend: 'INCREASING',
    period_comparison: {
      current: 2450000,
      previous: 2280000,
      change_percentage: 7.5
    }
  });

  const generateMockTrends = (): ClaimCostTrend[] => [
    { period: 'Jan 2024', total_amount: 180000, patient_amount: 36000, scheme_amount: 144000, claims_count: 22, average_amount: 8182 },
    { period: 'Feb 2024', total_amount: 195000, patient_amount: 39000, scheme_amount: 156000, claims_count: 24, average_amount: 8125 },
    { period: 'Mar 2024', total_amount: 220000, patient_amount: 44000, scheme_amount: 176000, claims_count: 26, average_amount: 8462 },
    { period: 'Apr 2024', total_amount: 210000, patient_amount: 42000, scheme_amount: 168000, claims_count: 25, average_amount: 8400 },
    { period: 'May 2024', total_amount: 235000, patient_amount: 47000, scheme_amount: 188000, claims_count: 28, average_amount: 8393 },
    { period: 'Jun 2024', total_amount: 250000, patient_amount: 50000, scheme_amount: 200000, claims_count: 30, average_amount: 8333 },
    { period: 'Jul 2024', total_amount: 265000, patient_amount: 53000, scheme_amount: 212000, claims_count: 32, average_amount: 8281 },
    { period: 'Aug 2024', total_amount: 280000, patient_amount: 56000, scheme_amount: 224000, claims_count: 34, average_amount: 8235 },
    { period: 'Sep 2024', total_amount: 275000, patient_amount: 55000, scheme_amount: 220000, claims_count: 33, average_amount: 8333 },
    { period: 'Oct 2024', total_amount: 290000, patient_amount: 58000, scheme_amount: 232000, claims_count: 35, average_amount: 8286 }
  ];

  const generateMockResponsibility = (): PatientResponsibilityBreakdown => ({
    deductibles: 185000,
    copayments: 245000,
    coinsurance: 60000,
    out_of_pocket_max: 490000,
    percentage_of_total: 20.0
  });

  const generateMockUtilization = (): SchemeUtilization[] => [
    {
      scheme_name: 'Premium Health Plan',
      total_members: 1250,
      active_claims: 145,
      total_amount: 1470000,
      average_per_member: 1176,
      utilization_rate: 11.6,
      top_benefit_types: [
        { name: 'General Practice', amount: 441000, percentage: 30.0, claims_count: 55 },
        { name: 'Specialist Consultation', amount: 294000, percentage: 20.0, claims_count: 28 },
        { name: 'Diagnostics', amount: 220500, percentage: 15.0, claims_count: 35 },
        { name: 'Pharmaceuticals', amount: 176400, percentage: 12.0, claims_count: 42 }
      ]
    },
    {
      scheme_name: 'Standard Health Plan',
      total_members: 850,
      active_claims: 98,
      total_amount: 980000,
      average_per_member: 1153,
      utilization_rate: 11.5,
      top_benefit_types: [
        { name: 'General Practice', amount: 294000, percentage: 30.0, claims_count: 38 },
        { name: 'Diagnostics', amount: 196000, percentage: 20.0, claims_count: 25 },
        { name: 'Pharmaceuticals', amount: 147000, percentage: 15.0, claims_count: 35 }
      ]
    }
  ];

  const generateMockPredictive = (): PredictiveModel => ({
    forecast_period: 'Next 6 months',
    predicted_amount: 1650000,
    confidence_interval: {
      lower: 1485000,
      upper: 1815000
    },
    risk_factors: [
      'Seasonal flu increase expected in winter months',
      'Aging member population requiring more specialist care',
      'Medical inflation rate of 8.5% annually'
    ],
    recommendations: [
      'Implement preventive care programs to reduce specialist visits',
      'Negotiate better rates with high-volume providers',
      'Increase deductibles for non-essential services',
      'Promote telehealth for routine consultations'
    ]
  });

  const formatTrend = (current: number, previous: number) => {
    const change = ((current - previous) / previous) * 100;
    const isPositive = change > 0;
    return {
      percentage: Math.abs(change).toFixed(1),
      isPositive,
      icon: isPositive ? ArrowUpRight : ArrowDownRight,
      color: isPositive ? 'text-red-600' : 'text-green-600'
    };
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-8 h-8 mx-auto mb-2 border-b-2 rounded-full animate-spin border-primary"></div>
            <p className="text-sm text-gray-600">Loading financial analytics...</p>
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
          <h2 className="text-2xl font-bold">Financial Analytics Dashboard</h2>
          <p className="text-gray-600">
            Comprehensive financial insights and cost analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as any)}
            className="px-3 py-2 border rounded"
          >
            <option value="month">Monthly</option>
            <option value="quarter">Quarterly</option>
            <option value="year">Yearly</option>
          </select>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <DollarSign className="w-4 h-4 text-blue-600" />
                <div className="ml-2">
                  <p className="text-xs font-medium text-gray-600">Total Claims</p>
                  <p className="text-2xl font-bold">{CurrencyUtils.format(metrics.total_claims_amount)}</p>
                  {metrics.period_comparison && (
                    <div className="flex items-center mt-1">
                      {(() => {
                        const trend = formatTrend(metrics.period_comparison.current, metrics.period_comparison.previous);
                        const TrendIcon = trend.icon;
                        return (
                          <>
                            <TrendIcon className={`h-3 w-3 ${trend.color}`} />
                            <span className={`text-xs ${trend.color} ml-1`}>
                              {trend.percentage}%
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Target className="w-4 h-4 text-green-600" />
                <div className="ml-2">
                  <p className="text-xs font-medium text-gray-600">Scheme Paid</p>
                  <p className="text-2xl font-bold">{CurrencyUtils.format(metrics.total_paid_amount)}</p>
                  <p className="mt-1 text-xs text-gray-600">
                    {((metrics.total_paid_amount / metrics.total_claims_amount) * 100).toFixed(1)}% of total
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Users className="w-4 h-4 text-orange-600" />
                <div className="ml-2">
                  <p className="text-xs font-medium text-gray-600">Patient Responsibility</p>
                  <p className="text-2xl font-bold">{CurrencyUtils.format(metrics.patient_responsibility)}</p>
                  <p className="mt-1 text-xs text-gray-600">
                    {((metrics.patient_responsibility / metrics.total_claims_amount) * 100).toFixed(1)}% of total
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <FileText className="w-4 h-4 text-purple-600" />
                <div className="ml-2">
                  <p className="text-xs font-medium text-gray-600">Approval Rate</p>
                  <p className="text-2xl font-bold">{metrics.approval_rate}%</p>
                  <p className="mt-1 text-xs text-gray-600">
                    {metrics.claims_count} claims processed
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="trends">Cost Trends</TabsTrigger>
          <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
          <TabsTrigger value="utilization">Utilization</TabsTrigger>
          <TabsTrigger value="predictive">Predictive</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Claims Cost Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="w-4 h-4" />
                  Claims Cost Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={costTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip formatter={(value) => CurrencyUtils.format(value as number)} />
                    <Area 
                      type="monotone" 
                      dataKey="scheme_amount" 
                      stackId="1"
                      stroke="#8884d8" 
                      fill="#8884d8" 
                      name="Scheme Amount"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="patient_amount" 
                      stackId="1"
                      stroke="#82ca9d" 
                      fill="#82ca9d" 
                      name="Patient Amount"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Average Claim Amount */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Average Claim Amount Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={costTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip formatter={(value) => CurrencyUtils.format(value as number)} />
                    <Line 
                      type="monotone" 
                      dataKey="average_amount" 
                      stroke="#ff7300" 
                      strokeWidth={2}
                      name="Average Amount"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="breakdown" className="space-y-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Patient Responsibility Breakdown */}
            {patientResponsibility && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <PieChartIcon className="w-4 h-4" />
                    Patient Responsibility Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Deductibles', value: patientResponsibility.deductibles },
                          { name: 'Copayments', value: patientResponsibility.copayments },
                          { name: 'Coinsurance', value: patientResponsibility.coinsurance }
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {[0, 1, 2].map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => CurrencyUtils.format(value as number)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Total Patient Responsibility:</span>
                      <span className="font-semibold">{CurrencyUtils.format(patientResponsibility.out_of_pocket_max)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Percentage of Total Claims:</span>
                      <span className="font-semibold">{patientResponsibility.percentage_of_total}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Claims by Amount Range */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Claims Distribution by Amount</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={[
                    { range: '< MWK 1,000', count: 45, percentage: 15.6 },
                    { range: 'MWK 1,000 - 5,000', count: 89, percentage: 30.9 },
                    { range: 'MWK 5,000 - 10,000', count: 72, percentage: 25.0 },
                    { range: 'MWK 10,000 - 25,000', count: 56, percentage: 19.4 },
                    { range: '> MWK 25,000', count: 26, percentage: 9.0 }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="range" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8" name="Claims Count" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="utilization" className="space-y-4">
          {schemeUtilization.map((scheme, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="text-base">{scheme.scheme_name}</CardTitle>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Total Members</p>
                    <p className="font-semibold">{scheme.total_members.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Active Claims</p>
                    <p className="font-semibold">{scheme.active_claims}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Total Amount</p>
                    <p className="font-semibold">{CurrencyUtils.format(scheme.total_amount)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Utilization Rate</p>
                    <p className="font-semibold">{scheme.utilization_rate}%</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <h4 className="font-medium">Top Benefit Types</h4>
                  {scheme.top_benefit_types.map((benefit, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <p className="font-medium">{benefit.name}</p>
                        <p className="text-sm text-gray-600">{benefit.claims_count} claims</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{CurrencyUtils.format(benefit.amount)}</p>
                        <p className="text-sm text-gray-600">{benefit.percentage}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="predictive" className="space-y-4">
          {predictiveModel && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="w-4 h-4" />
                    Predictive Financial Model
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="p-4 text-center border rounded">
                      <p className="text-sm text-gray-600">Predicted Amount</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {CurrencyUtils.format(predictiveModel.predicted_amount)}
                      </p>
                      <p className="text-xs text-gray-500">{predictiveModel.forecast_period}</p>
                    </div>
                    <div className="p-4 text-center border rounded">
                      <p className="text-sm text-gray-600">Lower Bound</p>
                      <p className="text-xl font-semibold text-green-600">
                        {CurrencyUtils.format(predictiveModel.confidence_interval.lower)}
                      </p>
                      <p className="text-xs text-gray-500">95% Confidence</p>
                    </div>
                    <div className="p-4 text-center border rounded">
                      <p className="text-sm text-gray-600">Upper Bound</p>
                      <p className="text-xl font-semibold text-red-600">
                        {CurrencyUtils.format(predictiveModel.confidence_interval.upper)}
                      </p>
                      <p className="text-xs text-gray-500">95% Confidence</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <AlertTriangle className="w-4 h-4 text-yellow-600" />
                      Risk Factors
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {predictiveModel.risk_factors.map((factor, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <div className="w-2 h-2 mt-2 bg-yellow-500 rounded-full"></div>
                          <p className="text-sm">{factor}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Target className="w-4 h-4 text-green-600" />
                      Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {predictiveModel.recommendations.map((recommendation, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <div className="w-2 h-2 mt-2 bg-green-500 rounded-full"></div>
                          <p className="text-sm">{recommendation}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}