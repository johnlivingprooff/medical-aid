import { useState, useEffect } from 'react';
import { networkApi } from '@/lib/api';
import type { ProviderDirectory } from '@/types/models';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, Phone, Mail, MapPin, CheckCircle, Clock, XCircle, Search } from 'lucide-react';

export function ProviderDirectory() {
  const [providers, setProviders] = useState<ProviderDirectory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [facilityTypeFilter, setFacilityTypeFilter] = useState<string>('');

  useEffect(() => {
    loadProviders();
  }, [facilityTypeFilter]);

  const loadProviders = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await networkApi.getProviderDirectory({
        facility_type: facilityTypeFilter || undefined,
      });
      setProviders(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load provider directory');
      console.error('Error loading providers:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredProviders = providers.filter(p => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      p.facility_name.toLowerCase().includes(searchLower) ||
      p.city.toLowerCase().includes(searchLower) ||
      p.username.toLowerCase().includes(searchLower)
    );
  });

  const getCredentialStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'PENDING':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'REJECTED':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusVariant = (status: string): 'default' | 'success' | 'warning' | 'destructive' | 'outline' => {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'PENDING':
        return 'warning';
      case 'SUSPENDED':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="py-6">
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Search & Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Facility name, city, username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Facility Type</label>
              <Select value={facilityTypeFilter} onValueChange={setFacilityTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Types</SelectItem>
                  <SelectItem value="HOSPITAL">Hospital</SelectItem>
                  <SelectItem value="CLINIC">Clinic</SelectItem>
                  <SelectItem value="PHARMACY">Pharmacy</SelectItem>
                  <SelectItem value="LAB">Laboratory</SelectItem>
                  <SelectItem value="IMAGING">Imaging Center</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Provider List */}
      <div className="space-y-4">
        {filteredProviders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No providers found</p>
            </CardContent>
          </Card>
        ) : (
          filteredProviders.map((provider) => (
            <Card key={provider.id}>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold">{provider.facility_name}</h3>
                        <Badge variant="outline">
                          <Building2 className="h-3 w-3 mr-1" />
                          {provider.facility_type}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">@{provider.username}</p>
                    </div>
                    
                    {provider.is_active && (
                      <Badge variant="success">Active</Badge>
                    )}
                  </div>

                  {/* Contact Info */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{provider.phone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{provider.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{provider.city}</span>
                    </div>
                  </div>

                  {/* Network Memberships */}
                  {provider.network_memberships.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Network Memberships</h4>
                      <div className="flex flex-wrap gap-2">
                        {provider.network_memberships.map((membership, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs border rounded-md px-3 py-1.5">
                            <span className="font-medium">{membership.scheme_name}</span>
                            <Badge variant={getStatusVariant(membership.status)} className="gap-1 text-xs">
                              {membership.status}
                            </Badge>
                            <div className="flex items-center gap-1">
                              {getCredentialStatusIcon(membership.credential_status)}
                              <span className="text-muted-foreground">{membership.credential_status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Performance Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                    <div>
                      <p className="text-xs text-muted-foreground">Claims (90d)</p>
                      <p className="text-lg font-semibold">{provider.performance_metrics.total_claims_90d}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Approved (90d)</p>
                      <p className="text-lg font-semibold text-green-600">
                        {provider.performance_metrics.approved_claims_90d}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Approval Rate</p>
                      <p className="text-lg font-semibold text-blue-600">
                        {provider.performance_metrics.approval_rate.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Active Networks</p>
                      <p className="text-lg font-semibold">{provider.performance_metrics.active_networks}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
