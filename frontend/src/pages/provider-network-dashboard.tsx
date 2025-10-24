import { useEffect, useState } from 'react';
import { networkApi } from '../lib/api';
import type { ProviderNetworkDashboard, ProviderNetworkStatus } from '../types/models';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  AlertTriangle, 
  Building2, 
  CheckCircle, 
  TrendingUp, 
  Users, 
  XCircle,
  Clock,
  FileCheck,
  FileX,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';

export default function ProviderNetworkDashboard() {
  const [dashboard, setDashboard] = useState<ProviderNetworkDashboard | null>(null);
  const [statusDetails, setStatusDetails] = useState<ProviderNetworkStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [dashboardData, statusData] = await Promise.all([
        networkApi.getNetworkDashboard(),
        networkApi.getNetworkStatus(),
      ]);
      
      setDashboard(dashboardData);
      // Normalize status data: API may return an object { timestamp, total_providers, network_status: [...] }
      const normalizedStatus = Array.isArray(statusData)
        ? statusData
        : (statusData as any)?.network_status ?? [];
      setStatusDetails(normalizedStatus);
    } catch (err: any) {
      setError(err.message || 'Failed to load network dashboard');
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'EXCELLENT':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'GOOD':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'FAIR':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'POOR':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'CRITICAL':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-blue-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 space-y-6">
        <Skeleton className="h-12 w-96" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Error Loading Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No network data available</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Provider Network Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Real-time monitoring of provider network health and performance
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Total Memberships
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{dashboard.network_overview.total_memberships}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {dashboard.network_overview.active_memberships} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Network Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${getHealthScoreColor(dashboard.average_health_score)}`}>
              {dashboard.average_health_score.toFixed(1)}
            </div>
            <Progress value={dashboard.average_health_score} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Credentialing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {dashboard.credentialing_status.completion_rate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {dashboard.credentialing_status.approved} / {dashboard.network_overview.total_memberships} approved
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Active Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">
              {dashboard.alerts_count}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Requires attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Status */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="providers">Provider Status</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Health Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Health Status Distribution</CardTitle>
                <CardDescription>Provider count by health rating</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'CRITICAL'].map((status) => {
                    const count = statusDetails.filter(
                      (s) => s.network_health.health_status === status
                    ).length;
                    const percentage = statusDetails.length > 0
                      ? (count / statusDetails.length) * 100
                      : 0;
                    
                    return (
                      <div key={status} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{status}</span>
                          <span className="text-muted-foreground">
                            {count} ({percentage.toFixed(0)}%)
                          </span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Network Statistics</CardTitle>
                <CardDescription>Current status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Approved Credentials</span>
                  </div>
                  <span className="font-semibold">{dashboard.credentialing_status.approved}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-yellow-600" />
                    <span>Pending Credentials</span>
                  </div>
                  <span className="font-semibold">{dashboard.credentialing_status.pending}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-blue-600" />
                    <span>Active Memberships</span>
                  </div>
                  <span className="font-semibold">{dashboard.network_overview.active_memberships}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-purple-600" />
                    <span>Total Memberships</span>
                  </div>
                  <span className="font-semibold">{dashboard.network_overview.total_memberships}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="providers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Provider Status Details</CardTitle>
              <CardDescription>
                {statusDetails.length} provider{statusDetails.length !== 1 ? 's' : ''} in network
              </CardDescription>
            </CardHeader>
            <CardContent>
              {statusDetails.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No provider data available</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {statusDetails.map((status, index) => (
                    <Card key={index} className={`border-2 ${getHealthStatusColor(status.network_health.health_status)}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-3">
                              <span className="font-semibold">{status.provider.facility_name}</span>
                              <Badge variant={status.real_time_status.is_active ? 'success' : 'outline'}>
                                {status.real_time_status.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                              {status.real_time_status.is_credentialed && (
                                <Badge variant="outline" className="gap-1">
                                  <FileCheck className="h-3 w-3" />
                                  Credentialed
                                </Badge>
                              )}
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Health Score</span>
                                <p className={`font-semibold ${getHealthScoreColor(status.network_health.health_score)}`}>
                                  {status.network_health.health_score}/100
                                </p>
                              </div>

                              <div>
                                <span className="text-muted-foreground">Membership</span>
                                <p className="font-medium">{status.network_membership.status}</p>
                              </div>

                              <div>
                                <span className="text-muted-foreground">Approval Rate</span>
                                <p className="font-medium">
                                  {status.performance_metrics.claims.approval_rate.toFixed(1)}%
                                </p>
                              </div>

                              {status.real_time_status.days_until_expiry !== null && status.real_time_status.days_until_expiry !== undefined && (
                                <div>
                                  <span className="text-muted-foreground">Expires In</span>
                                  <p className={`font-medium ${status.real_time_status.days_until_expiry < 30 ? 'text-orange-600' : ''}`}>
                                    {status.real_time_status.days_until_expiry} days
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Documents Status */}
                            <div className="flex gap-4 text-xs">
                              <div className="flex items-center gap-1">
                                <FileCheck className="h-3 w-3 text-green-600" />
                                <span>{status.network_health.documents.approved} Valid</span>
                              </div>
                              {status.network_health.documents.pending > 0 && (
                                <div className="flex items-center gap-1 text-orange-600">
                                  <Clock className="h-3 w-3" />
                                  <span>{status.network_health.documents.pending} Pending</span>
                                </div>
                              )}
                              {status.network_health.documents.rejected > 0 && (
                                <div className="flex items-center gap-1 text-red-600">
                                  <FileX className="h-3 w-3" />
                                  <span>{status.network_health.documents.rejected} Rejected</span>
                                </div>
                              )}
                            </div>

                            {/* Alerts */}
                            {status.alerts && status.alerts.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {status.alerts.map((alert, idx) => (
                                  <div key={idx} className="flex items-start gap-2 text-sm">
                                    <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                                    <span className="text-orange-600">{alert.message}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Alerts</CardTitle>
              <CardDescription>Issues requiring attention</CardDescription>
            </CardHeader>
            <CardContent>
              {statusDetails.flatMap((s) => s.alerts || []).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-600" />
                  <p>No active alerts</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {statusDetails.map((status, statusIdx) =>
                    status.alerts?.map((alert, idx) => (
                      <Card key={`${statusIdx}-${idx}`} className="border-orange-200 bg-orange-50">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{status.provider.facility_name}</span>
                                <Badge variant="outline" className="text-orange-600 border-orange-600">
                                  {alert.severity}
                                </Badge>
                              </div>
                              <p className="text-sm text-orange-900">{alert.message}</p>
                              <p className="text-xs text-orange-700">
                                {alert.type} - {alert.action_required}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
